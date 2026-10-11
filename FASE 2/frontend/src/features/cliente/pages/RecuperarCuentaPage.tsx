import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../../../shared/api/apiFetch'
import { manejarRespuesta } from '../../../shared/api/httpErrors'
import { useCustomer } from '../../../shared/context/CustomerContext'

export function RecuperarCuentaPage() {
  const [params]=useSearchParams()
  const token=params.get('token')
  const {logout}=useCustomer()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmation,setConfirmation]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  return <div className="max-w-md space-y-4">
    <h1 className="text-2xl font-semibold">{token?'Restablecer contraseña':'Recuperar cuenta'}</h1>
    <form className="space-y-3" onSubmit={async e=>{
      e.preventDefault();if(busy)return;setError('');setMessage('')
      if(token&&password!==confirmation){setError('Las contraseñas no coinciden.');return}
      setBusy(true)
      try{
        const result=await manejarRespuesta<{message:string}>(await apiFetch(`/api/customers/password/${token?'reset':'forgot'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(token?{token,password}:{email})}))
        setMessage(result.message);setPassword('');setConfirmation('');if(token)logout()
      }catch(e){setError(e instanceof Error?e.message:'No se pudo recuperar la cuenta')}finally{setBusy(false)}
    }}>
      {token?<><label className="block">Nueva contraseña<input className="border rounded p-2 block w-full" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="block">Confirmar contraseña<input className="border rounded p-2 block w-full" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></>:<label className="block">Correo de tu cuenta<input className="border rounded p-2 block w-full" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
      <button disabled={busy} className="bg-brand text-white rounded px-4 py-2">{busy?'Procesando…':token?'Restablecer contraseña':'Enviar enlace de recuperación'}</button>
    </form>
    {error&&<p role="alert" className="text-falla">{error}</p>}{message&&<p role="status" className="text-ok">{message}</p>}
    <Link to="/ingresar" className="text-brand">Volver a iniciar sesión</Link>
  </div>
}
