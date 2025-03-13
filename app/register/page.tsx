"use client"

import type React from "react"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { UserPlus, Mail, User, KeyRound, Hash, Loader2 } from "lucide-react"

export default function Register() {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [numeroPolera, setNumeroPolera] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre,
            numero_polera: numeroPolera ? Number.parseInt(numeroPolera) : null,
          },
        },
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess("Cuenta creada correctamente. Revisa tu email para confirmar tu cuenta.")
        setTimeout(() => {
          router.push("/login")
        }, 3000)
      }
    } catch (err) {
      setError("Ocurrió un error al crear la cuenta")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="contenedor-auth">
      <div className="tarjeta-auth">
        <div className="auth-icon-container">
          <UserPlus className="auth-icon" />
        </div>

        <h1 className="auth-title">Crear Cuenta</h1>

        {error && <div className="mensaje-error">{error}</div>}
        {success && <div className="mensaje-exito">{success}</div>}

        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label htmlFor="nombre">Nombre Completo</label>
            <div className="input-container">
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="input-campo"
                placeholder="Tu nombre"
              />
              <User className="input-icon" size={18} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <div className="input-container">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-campo"
                placeholder="tu@email.com"
              />
              <Mail className="input-icon" size={18} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="input-container">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-campo"
                placeholder="••••••••"
              />
              <KeyRound className="input-icon" size={18} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="numero_polera">Número de Polera</label>
            <div className="input-container">
              <input
                id="numero_polera"
                type="number"
                value={numeroPolera}
                onChange={(e) => setNumeroPolera(e.target.value)}
                className="input-campo"
                placeholder="10"
              />
              <Hash className="input-icon" size={18} />
            </div>
          </div>

          <button type="submit" className="btn-primario" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                <span>Cargando...</span>
              </>
            ) : (
              "Registrarse"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿Ya tienes una cuenta?{" "}
            <Link href="/login" className="auth-link">
              Inicia Sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

