"use client"

import type React from "react"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { User, KeyRound, Loader2, Mail } from "lucide-react"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(true) // Start with loading true to check auth
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getSession()

        // If user is already logged in, redirect to dashboard
        if (data.session) {
          router.push("/")
          return
        }

        // If no session, allow access to login page
        setLoading(false)
      } catch (err) {
        console.error("Error checking authentication:", err)
        setLoading(false)
      }
    }

    checkUser()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      setError("Ocurrió un error al iniciar sesión")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while checking authentication
  if (loading && !error) {
    return (
      <div className="contenedor-auth">
        <div className="tarjeta-auth flex items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
          <span className="ml-2">Verificando sesión...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="contenedor-auth">
      <div className="tarjeta-auth">
        <div className="auth-icon-container">
          <User className="auth-icon" />
        </div>

        <h1 className="auth-title">Iniciar Sesión</h1>

        {error && <div className="mensaje-error">{error}</div>}

        <form onSubmit={handleLogin} className="auth-form">
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
                className="input-campo"
                placeholder="••••••••"
              />
              <KeyRound className="input-icon" size={18} />
            </div>
          </div>

          <button type="submit" className="btn-primario" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                <span>Cargando...</span>
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿No tienes una cuenta?{" "}
            <Link href="/register" className="auth-link">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

