import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { httpCustomerRepository } from '../../features/cliente/api/customerRepository.http'
import type { Customer } from '../../features/cliente/types'
import type { DatosRegistro } from '../../features/cliente/api/customerRepository'

export type { Customer }

const STORAGE_KEY = 'sgo-customer-session'

interface SesionGuardada extends Customer {
  token: string
}

function cargarSesion(): SesionGuardada | null {
  const crudo = localStorage.getItem(STORAGE_KEY)
  if (!crudo) return null
  try {
    const valor = JSON.parse(crudo)
    return valor?.token ? (valor as SesionGuardada) : null
  } catch {
    return null
  }
}

export interface ResultadoActualizarPerfil {
  ok: boolean
  motivo?: string
}

interface CustomerContextValue {
  /** null mientras no haya iniciado sesión: las páginas que lo necesitan deben revisarlo y
   * redirigir a /ingresar, igual que el personal con isAdmin. */
  customer: Customer | null
  checking: boolean
  authError: string | null
  submitting: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (datos: DatosRegistro) => Promise<boolean>
  logout: () => void
  actualizarPerfil: (datos: { nombre: string; telefono: string; email: string; direccion: string }) => Promise<ResultadoActualizarPerfil>
}

const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionGuardada | null>(() => cargarSesion())
  const [authError, setAuthError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checking,setChecking]=useState(!!cargarSesion())
  useEffect(() => {
    function expired(event: Event) {
      if ((event as CustomEvent<string>).detail !== STORAGE_KEY) return
      localStorage.removeItem(STORAGE_KEY); setSesion(null); setAuthError('La sesión venció. Ingresa de nuevo.')
    }
    window.addEventListener('sgo-session-expired', expired)
    return () => window.removeEventListener('sgo-session-expired', expired)
  }, [])
  useEffect(()=>{
    let stopped=false
    async function refresh() {
      const saved=cargarSesion()
      if(!saved){if(!stopped){setSesion(null);setChecking(false)}return}
      try{
        const response=await globalThis.fetch(`/api/customers/${saved.id}`,{headers:{Authorization:`Bearer ${saved.token}`}})
        if(stopped||cargarSesion()?.token!==saved.token)return
        if(response.status===401||response.status===403){localStorage.removeItem(STORAGE_KEY);setSesion(null);setAuthError('La sesión venció o fue revocada.');return}
        if(!response.ok) return
        const c=await response.json()
        const next={...saved,nombre:c.fullName,email:c.email??'',telefono:c.phone??'',direccion:c.address??''}
        if(!stopped&&cargarSesion()?.token===saved.token){localStorage.setItem(STORAGE_KEY,JSON.stringify(next));setSesion(next)}
      }finally{if(!stopped)setChecking(false)}
    }
    const tick=()=>{void refresh().catch(()=>{if(!stopped)setChecking(false)})}
    const storage=(e:StorageEvent)=>{if(e.key===STORAGE_KEY){setSesion(cargarSesion());setChecking(!!cargarSesion());tick()}}
    tick();const timer=setInterval(tick,10000);window.addEventListener('focus',tick);window.addEventListener('storage',storage)
    return()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',tick);window.removeEventListener('storage',storage)}
  },[])

  function guardarSesion(nueva: SesionGuardada) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nueva))
    setSesion(nueva)
  }

  async function login(email: string, password: string): Promise<boolean> {
    setSubmitting(true)
    setAuthError(null)
    try {
      guardarSesion(await httpCustomerRepository.login({ email, password }))
      return true
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'No se pudo iniciar sesión')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function register(datos: DatosRegistro): Promise<boolean> {
    setSubmitting(true)
    setAuthError(null)
    try {
      guardarSesion(await httpCustomerRepository.register(datos))
      return true
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'No se pudo crear la cuenta')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setSesion(null)
  }

  const customer: Customer | null = sesion
    ? { id: sesion.id, nombre: sesion.nombre, telefono: sesion.telefono, email: sesion.email, direccion: sesion.direccion }
    : null

  async function actualizarPerfil(datos: {
    nombre: string
    telefono: string
    email: string
    direccion: string
  }): Promise<ResultadoActualizarPerfil> {
    if (!customer || !sesion) return { ok: false, motivo: 'No se pudo identificar tu perfil' }
    try {
      const actualizado = await httpCustomerRepository.updateCustomer(customer.id, datos)
      if (!actualizado) return { ok: false, motivo: 'No encontramos tu perfil de cliente' }
      guardarSesion({ ...actualizado, token: sesion.token })
      return { ok: true }
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo guardar tu información' }
    }
  }

  return (
    <CustomerContext.Provider value={{ customer, checking, authError, submitting, login, register, logout, actualizarPerfil }}>
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomer(): CustomerContextValue {
  const value = useContext(CustomerContext)
  if (!value) throw new Error('useCustomer debe usarse dentro de <CustomerProvider>')
  return value
}
