#!/usr/bin/env python3
"""Single-command QA, Windows/Linux/macOS. Only local disposable Docker resources."""
import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERE = Path(__file__).resolve().parent
FRONT = ROOT / 'FASE 2' / 'frontend'
BACK = ROOT / 'FASE 2' / 'backend'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--keep-stack', action='store_true', help='Keep only the disposable QA stack for inspection')
    parser.add_argument('--suite', choices=['all', 'integracion', 'capacidad', 'e2e'], default='all',
                        help='Partial executions are marked partial; the acceptance gate requires all')
    args = parser.parse_args()
    for command in ['docker', 'node', 'npm']:
        if not shutil.which(command):
            parser.error('Missing prerequisite: ' + command)
    npm = shutil.which('npm')
    node_version = subprocess.check_output(['node', '--version'], text=True).strip()
    if int(node_version[1:].split('.')[0]) < 22:
        parser.error('Node 22+ required')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6]
    out = HERE / 'resultados' / stamp
    out.mkdir(parents=True)
    project = 'fase3qa-' + stamp.lower()
    env = dict(os.environ, PYTHONUTF8='1', PYTHONUNBUFFERED='1',
               COMPOSE_PROJECT_NAME=project, QA_RESULTS=str(out),
               SGO_URL='http://127.0.0.1:18081', E2E_BASE_URL='http://127.0.0.1:18081',
               DB_APP_PASSWORD='sgologic_app_dev', CI='true',
               PLAYWRIGHT_HTML_OUTPUT_DIR=str(out / 'playwright-report'),
               PLAYWRIGHT_JUNIT_OUTPUT_FILE=str(out / 'e2e.xml'))
    # No ambient Compose overrides or user .env files affect the test topology.
    env.pop('COMPOSE_FILE', None)
    env.pop('COMPOSE_PROFILES', None)
    for line in (HERE / 'test.env').read_text(encoding='utf-8').splitlines():
        if line and not line.startswith('#'):
            key, value = line.split('=', 1)
            env[key] = value
    config = json.loads(subprocess.check_output(['docker', 'compose', '--env-file', str(HERE / 'test.env'),
                        '-f', str(ROOT / 'FASE 2' / 'docker-compose.yml'), 'config', '--format', 'json'],
                        encoding='utf-8', env=env))
    config['name'] = project
    for service in config['services'].values():
        service.pop('container_name', None)
        service['restart'] = 'no'
    # Compose config resolves volume/network names using its input project. Explicitly scope them.
    for kind in ['volumes', 'networks']:
        for key, spec in config.get(kind, {}).items():
            spec['name'] = project + '_' + key
    config['services']['backend']['environment']['SGOLOGIC_AUTH_FRONTEND_URL'] = env['SGO_URL']
    # DB remains internal: SQL checks use compose exec, never a host database.
    config['services']['db'].pop('ports', None)
    compose_file = out / 'compose.json'
    compose_file.write_text(json.dumps(config, indent=2), encoding='utf-8')
    env['QA_COMPOSE_FILE'] = str(compose_file)
    compose = ['docker', 'compose', '-f', str(compose_file), '-p', project]
    stages = []
    summary = dict(started_utc=datetime.now(timezone.utc).isoformat(), project=project,
                   suite=args.suite, node=node_version, python=sys.version,
                   platform=platform.platform(), cpu_count=os.cpu_count(), stages=stages, passed=False)
    sources = [p for base in [BACK / 'src', FRONT / 'src', FRONT / 'e2e', HERE]
               for p in base.rglob('*') if p.is_file() and p.suffix in ['.java', '.ts', '.tsx', '.py']
               and 'resultados' not in p.parts and '__pycache__' not in p.parts]
    summary['source_sha256'] = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}

    def run(name, command, cwd=ROOT, timeout=1200, check=True):
        print('\n>>> ' + name, flush=True)
        started = time.monotonic()
        log = out / (name + '.log')
        try:
            with log.open('w', encoding='utf-8') as stream:
                result = subprocess.run([str(c) for c in command], cwd=cwd, env=env,
                                        stdout=stream, stderr=subprocess.STDOUT, timeout=timeout)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = 124
        except OSError as error:
            log.write_text(str(error), encoding='utf-8')
            code = 127
        stages.append(dict(name=name, exit_code=code, seconds=round(time.monotonic()-started, 3), log=log.name))
        print('\n'.join(log.read_text(encoding='utf-8', errors='replace').splitlines()[-16:]), flush=True)
        if code and check:
            raise RuntimeError(f'{name} failed ({code}); see {log}')
        return code

    def junit_count(file):
        tree = ET.parse(file)
        cases = tree.findall('.//testcase')
        if not cases or any(c.find('failure') is not None or c.find('error') is not None or
                            c.find('skipped') is not None for c in cases):
            raise RuntimeError('Missing/pending/failing test evidence: ' + str(file))
        return len(cases)

    try:
        run('docker-version', ['docker', 'version'], timeout=60)
        if args.suite == 'all':
            run('unitarias-backend', ['docker', 'run', '--rm', '-v', str(BACK) + ':/app',
                '-v', 'fase3qa-m2:/root/.m2', '-w', '/app', 'maven:3.9-eclipse-temurin-21',
                'mvn', '-B', 'clean', 'verify'])
            shutil.copytree(BACK / 'target' / 'surefire-reports', out / 'junit-backend')
        if args.suite in ['all', 'e2e']:
            run('npm-ci', [npm, 'ci'], FRONT)
            if args.suite == 'all':
                run('unitarias-frontend', [npm, 'test', '--', '--reporter=default', '--reporter=junit',
                     '--outputFile=' + str(out / 'unitarias-frontend.xml')], FRONT)
                run('lint', [npm, 'run', 'lint'], FRONT)
                run('build-frontend', [npm, 'run', 'build'], FRONT)
            browser_command = [npm, 'exec', '--', 'playwright', 'install']
            if sys.platform.startswith('linux'):
                browser_command.append('--with-deps')
            run('navegador', [*browser_command, 'chromium'], FRONT)
        run('stack', [*compose, 'up', '-d', '--build', '--wait', '--wait-timeout', '300'], timeout=1800)
        env['SGO_DB_CONTAINER'] = subprocess.check_output([*compose, 'ps', '-q', 'db'], encoding='utf-8').strip()
        if args.suite in ['all', 'integracion']:
            run('integracion', [sys.executable, HERE / 'test_integracion.py'])
        if args.suite == 'all':
            for script in ['prueba_fase2', 'prueba_operaciones', 'prueba_seguridad', 'prueba_pendientes']:
                run(script, [sys.executable, ROOT / 'FASE 2' / 'pruebas' / (script + '.py')])
        if args.suite in ['all', 'capacidad']:
            for category in ['carga', 'estres']:
                run(category, [sys.executable, HERE / 'test_capacidad.py', category])
        if args.suite == 'all':
            for script, extra in [
                ('prueba_reserva_concurrente', ['--clientes', '80']),
                ('prueba_flujo_volumen', ['--clientes', '60', '--espera', '180']),
                ('prueba_rendimiento', ['--peticiones', '1000', '--concurrencia', '32',
                                       '--salida', str(out / 'rendimiento.json')])]:
                run(script, [sys.executable, ROOT / 'FASE 2' / 'pruebas' / (script + '.py'),
                             '--base', env['SGO_URL'], *extra])
            run('caidas-reales', [sys.executable, ROOT / 'FASE 2' / 'pruebas' / 'prueba_caidas.py'])
        if args.suite in ['all', 'e2e']:
            run('e2e', [npm, 'exec', '--', 'playwright', 'test', '--retries=0'], FRONT, timeout=1800)
        if args.suite == 'all':
            counts = dict(unitarias_backend=sum(junit_count(f) for f in (out / 'junit-backend').glob('TEST-*.xml')),
                          unitarias_frontend=junit_count(out / 'unitarias-frontend.xml'),
                          integracion=junit_count(out / 'integracion.xml'),
                          carga=junit_count(out / 'carga.xml'), estres=junit_count(out / 'estres.xml'),
                          e2e=junit_count(out / 'e2e.xml'))
            if any(n < 5 for n in counts.values()):
                raise RuntimeError('Minimum 5 per category not met: ' + str(counts))
            summary['tests'] = counts
        if any(hashlib.sha256((ROOT / p).read_bytes()).hexdigest() != digest
               for p, digest in summary['source_sha256'].items()):
            raise RuntimeError('Source changed during execution; repeat the acceptance run')
        summary['passed'] = True
    except (Exception, KeyboardInterrupt) as error:
        summary['error'] = str(error)
        print('ERROR: ' + str(error), file=sys.stderr, flush=True)
    finally:
        run('logs-stack', [*compose, 'logs', '--no-color', '--tail', '300'], check=False, timeout=60)
        run('estado-stack', [*compose, 'ps', '--all', '--format', 'json'], check=False, timeout=60)
        if not args.keep_stack:
            run('limpieza', [*compose, 'down', '--volumes', '--remove-orphans'], check=False, timeout=180)
            if stages[-1]['exit_code']:
                summary['passed'] = False
        summary['completed_utc'] = datetime.now(timezone.utc).isoformat()
        summary['passed'] = summary['passed'] and all(stage['exit_code'] == 0 for stage in stages)
        summary['complete_acceptance'] = summary['passed'] and args.suite == 'all'
        summary['artifacts_sha256'] = {str(f.relative_to(out)): hashlib.sha256(f.read_bytes()).hexdigest()
            for f in out.rglob('*') if f.is_file() and f.name != 'compose.json'}
        (out / 'resumen.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf-8')
        (HERE / 'resultados' / 'ultimo.json').write_text(json.dumps({'directory': str(out), **summary}, indent=2,
                                                        ensure_ascii=False), encoding='utf-8')
        print('\nREPORTES: ' + str(out), flush=True)
    return 0 if summary['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
