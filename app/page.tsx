"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import {
  CalendarDays,
  MapPin,
  Users,
  Clock,
  MessageSquare,
  Star,
  ChevronLeft,
  LogOut,
  Save,
  Edit,
  Plus,
  X,
  Menu,
  Trophy,
  Activity,
  Shield,
  User,
  Calendar,
  Zap,
  Award,
} from "lucide-react"

// Types
type Jugador = {
  id: string
  nombre: string
  numero_polera: number | null
  posicion?: string
  avatar_url?: string
  seleccionado?: boolean
  calificacion?: number
  position?: { x: number; y: number }
}

type Evento = {
  id: string
  titulo: string
  fecha: string
  hora: string
  lugar: string
  descripcion: string
  asistentes: string[]
  creador_id?: string
  tipo?: string
  estado?: string
}

type Comentario = {
  id: string
  evento_id: string
  usuario_id: string
  texto: string
  created_at: string
  usuario_nombre?: string
}

type CalificacionJugador = {
  id: string
  jugador_id: string
  usuario_id: string
  evento_id: string
  calificacion: number
  created_at: string
}

type JugadorPizarra = {
  id: string
  nombre: string
  numero_polera: number | null
  posicion?: string
}

type PizarraTactica = {
  id?: string
  evento_id: string
  formacion: string
  jugadores_seleccionados: JugadorPizarra[] | string[]
  posiciones: { [jugadorId: string]: { x: number; y: number } }
  ultima_actualizacion: string
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<Jugador | null>(null)
  const [loading, setLoading] = useState(true)
  const [seccionActiva, setSeccionActiva] = useState("eventos")
  const [eventos, setEventos] = useState<Evento[]>([])
  const [jugadores, setJugadores] = useState<Jugador[]>([])
  const [jugadoresSeleccionados, setJugadoresSeleccionados] = useState<Jugador[]>([])
  const [formacion, setFormacion] = useState("4-4-2")
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [nuevoComentario, setNuevoComentario] = useState("")
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [calificacionesJugadores, setCalificacionesJugadores] = useState<CalificacionJugador[]>([])
  const [jugadoresCalificaciones, setJugadoresCalificaciones] = useState<{ [key: string]: number }>({})
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [jugadoresPositions, setJugadoresPositions] = useState<{
    [eventoId: string]: { [jugadorId: string]: { x: number; y: number } }
  }>({})
  const [jugadoresSeleccionadosPorEvento, setJugadoresSeleccionadosPorEvento] = useState<{
    [eventoId: string]: Jugador[]
  }>({})
  const [formacionesPorEvento, setFormacionesPorEvento] = useState<{ [eventoId: string]: string }>({})
  const [draggingPlayer, setDraggingPlayer] = useState<string | null>(null)
  const campoRef = useRef<HTMLDivElement>(null)
  const [jugadoresCargados, setJugadoresCargados] = useState(false)
  const [pizarrasCargadas, setPizarrasCargadas] = useState<{ [eventoId: string]: boolean }>({})
  const [todosLosJugadores, setTodosLosJugadores] = useState<Jugador[]>([])
  const [perfilesMap, setPerfilesMap] = useState<Map<string, Jugador>>(new Map())
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  // Nuevo evento
  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: "",
    fecha: "",
    hora: "",
    lugar: "",
    descripcion: "",
    tipo: "amistoso",
    estado: "programado",
  })

  const [perfilEditable, setPerfilEditable] = useState<Jugador>({
    id: "",
    nombre: "",
    numero_polera: null,
    posicion: "",
    avatar_url: "",
  })

  const router = useRouter()

  // Efecto para verificar el modo oscuro
  useEffect(() => {
    const isDarkMode = localStorage.getItem("darkMode") === "true"
    setDarkMode(isDarkMode)
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  // Función para cambiar el modo oscuro
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    localStorage.setItem("darkMode", newDarkMode.toString())
    if (newDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  // Efecto principal para cargar datos iniciales
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getSession()

        if (!data.session) {
          router.push("/login")
          return
        }

        setUser(data.session.user)

        // Verificar políticas de seguridad
        await verificarPoliticasSeguridad()

        // Primero cargamos los jugadores y esperamos a que terminen
        await cargarTodosLosJugadores()

        // Luego cargamos el resto de los datos
        await cargarPerfil(data.session.user.id)
        await cargarEventos()

        setLoading(false)
      } catch (error) {
        console.error("Error al inicializar la aplicación:", error)
        setLoading(false)
      }
    }

    checkUser()
  }, [router])

  // Inicializar posiciones de jugadores basadas en la formación
  useEffect(() => {
    console.log("Efecto de inicialización de posiciones ejecutándose")

    if (!eventoSeleccionado) {
      console.log("No hay evento seleccionado, no se inicializan posiciones")
      return
    }

    const idEvento = eventoSeleccionado.id
    console.log(`Inicializando posiciones para evento ${idEvento}`)

    // Verificar si ya tenemos posiciones guardadas para este evento
    const posicionesExistentes = jugadoresPositions[idEvento] || {}
    if (Object.keys(posicionesExistentes).length > 0) {
      console.log("Ya existen posiciones para este evento, no se recalculan")
      return
    }

    // Forzar la inicialización de jugadores si no hay ninguno seleccionado
    if (!jugadoresSeleccionadosPorEvento[idEvento] || jugadoresSeleccionadosPorEvento[idEvento].length === 0) {
      console.log("No hay jugadores seleccionados para este evento, seleccionando algunos por defecto")

      // Seleccionar algunos jugadores por defecto (los primeros 11 asistentes)
      const asistentes = eventoSeleccionado.asistentes || []
      if (asistentes.length > 0) {
        const jugadoresAsistentes = todosLosJugadores.filter((j) => asistentes.includes(j.id)).slice(0, 11)

        if (jugadoresAsistentes.length > 0) {
          console.log(`Seleccionando ${jugadoresAsistentes.length} jugadores por defecto`)
          setJugadoresSeleccionadosPorEvento((prev) => ({
            ...prev,
            [idEvento]: jugadoresAsistentes,
          }))

          // Después de seleccionar jugadores, inicializar sus posiciones
          setTimeout(() => {
            inicializarPosicionesJugadores(idEvento)
          }, 500)
        }
      }
    } else {
      // Si ya hay jugadores seleccionados pero no posiciones, inicializar posiciones
      setTimeout(() => {
        inicializarPosicionesJugadores(idEvento)
      }, 500)
    }
  }, [eventoSeleccionado])

  const cargarPerfil = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

      if (error) {
        console.error("Error al cargar perfil:", error)
        return
      }

      if (data) {
        setUserProfile(data)
        setPerfilEditable(data)

        // Añadir el perfil del usuario a la lista de jugadores si no está ya
        setJugadores((prevJugadores) => {
          if (!prevJugadores.find((j) => j.id === data.id)) {
            return [...prevJugadores, data]
          }
          return prevJugadores
        })

        // También añadirlo a todos los jugadores
        setTodosLosJugadores((prevJugadores) => {
          if (!prevJugadores.find((j) => j.id === data.id)) {
            return [...prevJugadores, data]
          }
          return prevJugadores
        })

        // Añadirlo al mapa de perfiles
        setPerfilesMap((prev) => {
          const newMap = new Map(prev)
          newMap.set(data.id, data)
          return newMap
        })
      }
    } catch (error) {
      console.error("Error al cargar perfil:", error)
    }
  }

  const cargarEventos = async () => {
    try {
      const { data, error } = await supabase.from("eventos").select("*").order("fecha", { ascending: true })

      if (error) {
        console.error("Error al cargar eventos:", error)
        return
      }

      if (data) {
        setEventos(data)
      }
    } catch (error) {
      console.error("Error al cargar eventos:", error)
    }
  }

  // Nueva función para cargar TODOS los jugadores
  const cargarTodosLosJugadores = async () => {
    try {
      console.log("Iniciando carga de todos los jugadores...")

      // Usar una consulta directa sin filtros de seguridad
      const { data, error } = await supabase.from("profiles").select("*").limit(100) // Aumentar el límite para asegurar que se carguen todos los perfiles

      if (error) {
        console.error("Error al cargar jugadores:", error)
        return
      }

      if (data && data.length > 0) {
        console.log(`Jugadores cargados exitosamente: ${data.length}`)
        // Mostrar los IDs de los jugadores para depuración
        console.log(
          "IDs de jugadores cargados:",
          data.map((j) => j.id),
        )

        // Crear un mapa para acceso rápido a los perfiles
        const mapaPerfiles = new Map<string, Jugador>()
        data.forEach((jugador) => {
          mapaPerfiles.set(jugador.id, jugador)
        })
        setPerfilesMap(mapaPerfiles)

        // Guardar en ambos estados
        setJugadores(data)
        setTodosLosJugadores(data)
        setJugadoresCargados(true)

        console.log("Jugadores guardados en el estado:", data.length)
      } else {
        console.warn("No se encontraron jugadores en la base de datos")
      }
    } catch (error) {
      console.error("Error al cargar jugadores:", error)
    }
  }

  // Función para cargar perfiles específicos por ID
  const cargarPerfilesPorIds = async (ids: string[]) => {
    if (!ids || ids.length === 0) return []

    try {
      console.log(`Cargando perfiles específicos para ${ids.length} IDs...`)

      const { data, error } = await supabase.from("profiles").select("*").in("id", ids)

      if (error) {
        console.error("Error al cargar perfiles específicos:", error)
        return []
      }

      if (data && data.length > 0) {
        console.log(`Perfiles específicos cargados: ${data.length}`)

        // Actualizar el mapa de perfiles
        const nuevoMapa = new Map(perfilesMap)
        data.forEach((perfil) => {
          nuevoMapa.set(perfil.id, perfil)
        })
        setPerfilesMap(nuevoMapa)

        // Actualizar todosLosJugadores
        setTodosLosJugadores((prev) => {
          const idsExistentes = new Set(prev.map((j) => j.id))
          const nuevosJugadores = data.filter((j) => !idsExistentes.has(j.id))
          if (nuevosJugadores.length > 0) {
            return [...prev, ...nuevosJugadores]
          }
          return prev
        })

        return data
      }

      return []
    } catch (error) {
      console.error("Error al cargar perfiles específicos:", error)
      return []
    }
  }

  // Modificar la función cargarPerfilesAsistentes para usar una consulta SQL directa
  const cargarPerfilesAsistentes = async (eventoId: string) => {
    try {
      console.log(`Cargando perfiles de asistentes para evento ${eventoId}...`)

      // Obtener el evento para acceder a la lista de asistentes
      const evento = eventos.find((e) => e.id === eventoId)
      if (!evento) {
        console.error("No se encontró el evento")
        return
      }

      // Si no hay asistentes, no hay nada que cargar
      if (!evento.asistentes || evento.asistentes.length === 0) {
        console.log("No hay asistentes para este evento")
        return
      }

      console.log(`Asistentes encontrados: ${evento.asistentes.length}`, evento.asistentes)

      // Intentar usar una función RPC para saltarse las restricciones de seguridad
      // Primero, intentamos con una consulta SQL directa usando rpc
      let { data: perfilesData, error: rpcError } = await supabase.rpc("obtener_todos_perfiles")

      if (rpcError) {
        console.error("Error al usar RPC para obtener perfiles:", rpcError)
        console.log("Intentando método alternativo...")

        // Si falla el RPC, intentamos con una consulta directa sin filtros
        const { data, error } = await supabase.from("profiles").select("*").limit(100)

        if (error) {
          console.error("Error al cargar perfiles de asistentes:", error)

          // Si todo falla, creamos perfiles básicos para todos los asistentes
          console.log("Creando perfiles básicos para todos los asistentes...")
          const perfilesBasicos = evento.asistentes.map((id) => ({
            id,
            nombre: `Jugador ${id.substring(0, 4)}`,
            numero_polera: null,
            posicion: "Sin posición",
          }))

          // Actualizar el mapa de perfiles con estos perfiles básicos
          const nuevoMapa = new Map(perfilesMap)
          perfilesBasicos.forEach((perfil) => {
            nuevoMapa.set(perfil.id, perfil)
          })
          setPerfilesMap(nuevoMapa)

          // Añadir estos perfiles básicos a todosLosJugadores
          setTodosLosJugadores((prev) => {
            const idsExistentes = new Set(prev.map((j) => j.id))
            const nuevosJugadores = perfilesBasicos.filter((j) => !idsExistentes.has(j.id))
            if (nuevosJugadores.length > 0) {
              return [...prev, ...nuevosJugadores]
            }
            return prev
          })

          return
        }

        if (data && data.length > 0) {
          perfilesData = data
        } else {
          perfilesData = []
        }
      }

      if (perfilesData && perfilesData.length > 0) {
        console.log(`Perfiles cargados: ${perfilesData.length}`)

        // Crear un mapa para acceso rápido a los perfiles
        const mapaPerfiles = new Map<string, Jugador>()
        perfilesData.forEach((jugador: Jugador) => {
          mapaPerfiles.set(jugador.id, jugador)
        })
        setPerfilesMap(mapaPerfiles)

        // Actualizar la lista de todos los jugadores con los nuevos perfiles
        setTodosLosJugadores(perfilesData)

        // También actualizar jugadores para mantener consistencia
        setJugadores(perfilesData)

        // Marcar como cargados
        setJugadoresCargados(true)
      } else {
        console.warn("No se encontraron perfiles en la base de datos")

        // Crear perfiles básicos para todos los asistentes
        const perfilesBasicos = evento.asistentes.map((id) => ({
          id,
          nombre: `Jugador ${id.substring(0, 4)}`,
          numero_polera: null,
          posicion: "Sin posición",
        }))

        // Actualizar el mapa de perfiles con estos perfiles básicos
        const nuevoMapa = new Map(perfilesMap)
        perfilesBasicos.forEach((perfil) => {
          nuevoMapa.set(perfil.id, perfil)
        })
        setPerfilesMap(nuevoMapa)

        // Añadir estos perfiles básicos a todosLosJugadores
        setTodosLosJugadores((prev) => {
          const idsExistentes = new Set(prev.map((j) => j.id))
          const nuevosJugadores = perfilesBasicos.filter((j) => !idsExistentes.has(j.id))
          if (nuevosJugadores.length > 0) {
            return [...prev, ...nuevosJugadores]
          }
          return prev
        })
      }
    } catch (error) {
      console.error("Error al cargar perfiles de asistentes:", error)
    }
  }

  const cargarComentarios = async (eventoId: string) => {
    try {
      const { data, error } = await supabase
        .from("comentarios")
        .select(`
          *,
          profiles:usuario_id (nombre)
        `)
        .eq("evento_id", eventoId)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Error al cargar comentarios:", error)
        return
      }

      if (data) {
        const comentariosFormateados = data.map((c) => ({
          ...c,
          usuario_nombre: c.profiles?.nombre,
        }))
        setComentarios(comentariosFormateados)
      }
    } catch (error) {
      console.error("Error al cargar comentarios:", error)
    }
  }

  const cargarCalificacionesJugadores = async (eventoId: string) => {
    try {
      const { data, error } = await supabase
        .from("calificaciones_jugadores")
        .select("*")
        .eq("evento_id", eventoId)
        .eq("usuario_id", user.id)

      if (error) {
        console.error("Error al cargar calificaciones:", error)
        return
      }

      if (data) {
        setCalificacionesJugadores(data)

        // Crear un objeto con las calificaciones por jugador
        const calificacionesPorJugador: { [key: string]: number } = {}
        data.forEach((cal) => {
          calificacionesPorJugador[cal.jugador_id] = cal.calificacion
        })
        setJugadoresCalificaciones(calificacionesPorJugador)
      }
    } catch (error) {
      console.error("Error al cargar calificaciones:", error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleCrearEvento = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { data, error } = await supabase.from("eventos").insert([
        {
          ...nuevoEvento,
          asistentes: [user.id],
          creador_id: user.id,
        },
      ])

      if (error) {
        alert("Error al crear el evento: " + error.message)
        return
      }

      setNuevoEvento({
        titulo: "",
        fecha: "",
        hora: "",
        lugar: "",
        descripcion: "",
        tipo: "amistoso",
        estado: "programado",
      })
      await cargarEventos()
      alert("Evento creado correctamente")
      setSeccionActiva("eventos")
    } catch (error) {
      console.error("Error al crear evento:", error)
      alert("Error al crear el evento")
    }
  }

  const handleAsistencia = async (eventoId: string, asistira: boolean) => {
    try {
      // Buscar el evento
      const evento = eventos.find((e) => e.id === eventoId)
      if (!evento) return

      let nuevosAsistentes = [...evento.asistentes]

      if (asistira) {
        // Agregar usuario si no está ya
        if (!nuevosAsistentes.includes(user.id)) {
          nuevosAsistentes.push(user.id)
        }
      } else {
        // Quitar usuario
        nuevosAsistentes = nuevosAsistentes.filter((id) => id !== user.id)
      }

      const { error } = await supabase.from("eventos").update({ asistentes: nuevosAsistentes }).eq("id", eventoId)

      if (error) {
        console.error("Error al actualizar asistencia:", error)
        return
      }

      await cargarEventos()

      // Si estamos en el detalle del evento, actualizamos el evento seleccionado
      if (eventoSeleccionado && eventoSeleccionado.id === eventoId) {
        setEventoSeleccionado({
          ...eventoSeleccionado,
          asistentes: nuevosAsistentes,
        })
      }
    } catch (error) {
      console.error("Error al manejar asistencia:", error)
    }
  }

  // Reemplazar la función seleccionarJugador para trabajar con eventos específicos
  const seleccionarJugador = (jugador: Jugador, eventoId?: string) => {
    const idEvento = eventoId || (eventoSeleccionado ? eventoSeleccionado.id : "global")

    // Obtener los jugadores seleccionados para este evento
    const jugadoresDeEvento = jugadoresSeleccionadosPorEvento[idEvento] || []

    if (jugadoresDeEvento.find((j) => j.id === jugador.id)) {
      // Quitar jugador
      const nuevosJugadores = jugadoresDeEvento.filter((j) => j.id !== jugador.id)
      setJugadoresSeleccionadosPorEvento({
        ...jugadoresSeleccionadosPorEvento,
        [idEvento]: nuevosJugadores,
      })
    } else {
      // Agregar jugador si no hay 11 ya seleccionados
      if (jugadoresDeEvento.length < 11) {
        const nuevosJugadores = [...jugadoresDeEvento, jugador]
        setJugadoresSeleccionadosPorEvento({
          ...jugadoresSeleccionadosPorEvento,
          [idEvento]: nuevosJugadores,
        })
      } else {
        alert("Ya has seleccionado 11 jugadores")
      }
    }
  }

  // Reemplazar la función cambiarFormacion para trabajar con eventos específicos
  const cambiarFormacion = (nuevaFormacion: string, eventoId?: string) => {
    const idEvento = eventoId || (eventoSeleccionado ? eventoSeleccionado.id : "global")

    setFormacionesPorEvento({
      ...formacionesPorEvento,
      [idEvento]: nuevaFormacion,
    })
  }

  // Modificar la función verDetalleEvento para cargar la pizarra
  const verDetalleEvento = async (evento: Evento) => {
    setEventoSeleccionado(evento)

    try {
      // Primero cargar los perfiles de los asistentes
      await cargarPerfilesAsistentes(evento.id)

      // Luego cargar el resto de los datos
      await Promise.all([
        cargarComentarios(evento.id),
        cargarCalificacionesJugadores(evento.id),
        cargarPizarraTactica(evento.id),
      ])

      setSeccionActiva("detalle-evento")
    } catch (error) {
      console.error("Error al cargar detalles del evento:", error)
      alert("Hubo un error al cargar los detalles del evento. Por favor, intenta de nuevo.")
    }
  }

  const volverAEventos = () => {
    setEventoSeleccionado(null)
    setSeccionActiva("eventos")
  }

  const enviarComentario = async () => {
    if (!eventoSeleccionado || !nuevoComentario.trim()) return

    try {
      const { error } = await supabase.from("comentarios").insert([
        {
          evento_id: eventoSeleccionado.id,
          usuario_id: user.id,
          texto: nuevoComentario,
        },
      ])

      if (error) {
        alert("Error al enviar comentario: " + error.message)
        return
      }

      setNuevoComentario("")
      await cargarComentarios(eventoSeleccionado.id)
    } catch (error) {
      console.error("Error al enviar comentario:", error)
    }
  }

  // Método alternativo para manejar la subida de imágenes
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return
    }

    const file = event.target.files[0]

    // Crear una vista previa local de la imagen
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        // Guardar la vista previa en base64
        const base64Image = e.target.result as string
        setAvatarPreview(base64Image)

        // Actualizar el perfil editable con la URL de la imagen en base64
        setPerfilEditable({
          ...perfilEditable,
          avatar_url: base64Image,
        })
      }
    }
    reader.readAsDataURL(file)
  }

  // Modificar la función guardarPerfil para manejar la imagen en base64
  const guardarPerfil = async () => {
    try {
      // Si tenemos una imagen en base64, la guardamos directamente en el perfil
      const perfilActualizado = {
        nombre: perfilEditable.nombre,
        numero_polera: perfilEditable.numero_polera,
        posicion: perfilEditable.posicion,
        avatar_url: perfilEditable.avatar_url,
      }

      const { error } = await supabase.from("profiles").update(perfilActualizado).eq("id", user.id)

      if (error) {
        alert("Error al actualizar perfil: " + error.message)
        return
      }

      setUserProfile(perfilEditable)
      setEditandoPerfil(false)
      setAvatarPreview(null)
      alert("Perfil actualizado correctamente")
    } catch (error) {
      console.error("Error al guardar perfil:", error)
    }
  }

  const calificarJugador = async (jugadorId: string, calificacion: number) => {
    if (!eventoSeleccionado) return

    try {
      // Verificar si ya existe una calificación para este jugador en este evento
      const calificacionExistente = calificacionesJugadores.find(
        (cal) => cal.jugador_id === jugadorId && cal.evento_id === eventoSeleccionado.id,
      )

      let error

      if (calificacionExistente) {
        // Actualizar calificación existente
        const { error: updateError } = await supabase
          .from("calificaciones_jugadores")
          .update({ calificacion })
          .eq("id", calificacionExistente.id)

        error = updateError
      } else {
        // Crear nueva calificación
        const { error: insertError } = await supabase.from("calificaciones_jugadores").insert([
          {
            jugador_id: jugadorId,
            usuario_id: user.id,
            evento_id: eventoSeleccionado.id,
            calificacion,
          },
        ])

        error = insertError
      }

      if (error) {
        alert("Error al calificar jugador: " + error.message)
        return
      }

      // Actualizar estado local
      setJugadoresCalificaciones({
        ...jugadoresCalificaciones,
        [jugadorId]: calificacion,
      })

      // Recargar calificaciones
      await cargarCalificacionesJugadores(eventoSeleccionado.id)
      alert("Jugador calificado correctamente")
    } catch (error) {
      console.error("Error al calificar jugador:", error)
    }
  }

  // Modificar las funciones de arrastre para trabajar con eventos específicos
  const handleDragStart = (e: React.MouseEvent, jugadorId: string) => {
    setDraggingPlayer(jugadorId)

    // Determinar el evento actual
    const idEvento = eventoSeleccionado ? eventoSeleccionado.id : "global"

    // Obtener la posición inicial del ratón
    const startX = e.clientX
    const startY = e.clientY

    // Obtener la posición actual del jugador
    const currentPosition = jugadoresPositions[idEvento]?.[jugadorId] || { x: 0, y: 0 }

    // Función para manejar el movimiento del ratón
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!campoRef.current) return

      // Calcular el desplazamiento
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      // Calcular la nueva posición
      const newX = Math.max(0, Math.min(campoRef.current.clientWidth - 60, currentPosition.x + deltaX))
      const newY = Math.max(0, Math.min(campoRef.current.clientHeight - 60, currentPosition.y + deltaY))

      // Actualizar la posición para este evento específico
      setJugadoresPositions((prev) => ({
        ...prev,
        [idEvento]: {
          ...(prev[idEvento] || {}),
          [jugadorId]: { x: newX, y: newY },
        },
      }))
    }

    // Función para manejar el final del arrastre
    const handleMouseUp = () => {
      setDraggingPlayer(null)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    // Agregar event listeners
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    // Prevenir comportamiento predeterminado
    e.preventDefault()
  }

  // Modificar la función de arrastre táctil para trabajar con eventos específicos
  const handleTouchStart = (e: React.TouchEvent, jugadorId: string) => {
    console.log(`Touch start en jugador ${jugadorId}`)

    // Prevenir comportamiento por defecto para evitar scroll
    e.stopPropagation()

    setDraggingPlayer(jugadorId)

    // Determinar el evento actual
    const idEvento = eventoSeleccionado ? eventoSeleccionado.id : "global"

    // Obtener la posición inicial del toque
    const touch = e.touches[0]
    const startX = touch.clientX
    const startY = touch.clientY

    // Obtener la posición actual del jugador
    const currentPosition = jugadoresPositions[idEvento]?.[jugadorId] || { x: 0, y: 0 }

    console.log(`Posición inicial: x=${currentPosition.x}, y=${currentPosition.y}`)

    // Función para manejar el movimiento del toque
    const handleTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault() // Importante para evitar el scroll

      if (!campoRef.current) return

      const touch = moveEvent.touches[0]

      // Calcular el desplazamiento
      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      // Calcular la nueva posición
      const newX = Math.max(0, Math.min(campoRef.current.clientWidth - 60, currentPosition.x + deltaX))
      const newY = Math.max(0, Math.min(campoRef.current.clientHeight - 60, currentPosition.y + deltaY))

      console.log(`Nueva posición: x=${newX}, y=${newY}`)

      // Actualizar la posición para este evento específico
      setJugadoresPositions((prev) => ({
        ...prev,
        [idEvento]: {
          ...(prev[idEvento] || {}),
          [jugadorId]: { x: newX, y: newY },
        },
      }))
    }

    // Función para manejar el final del toque
    const handleTouchEnd = () => {
      console.log("Touch end")
      setDraggingPlayer(null)
      document.removeEventListener("touchmove", handleTouchMove,)
      document.removeEventListener("touchend", handleTouchEnd)
    }

    // Agregar event listeners
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd)
  }

  // Modificar la función guardar información de jugadores en la pizarra táctica
  const guardarPizarraTactica = async (eventoId: string) => {
    if (!eventoId) return

    try {
      // Obtener los jugadores seleccionados para este evento
      const jugadoresSeleccionados = jugadoresSeleccionadosPorEvento[eventoId] || []

      // Extraer solo los IDs de los jugadores seleccionados en lugar de objetos completos
      const jugadoresIds = jugadoresSeleccionados.map((jugador) => jugador.id)

      const formacionActual = formacionesPorEvento[eventoId] || "4-4-2"
      const posicionesActuales = jugadoresPositions[eventoId] || {}

      // Crear el objeto de pizarra táctica con solo los IDs de jugadores
      const pizarraTactica = {
        evento_id: eventoId,
        formacion: formacionActual,
        jugadores_seleccionados: jugadoresIds, // Solo guardamos los IDs
        posiciones: posicionesActuales,
        ultima_actualizacion: new Date().toISOString(),
      }

      console.log("Guardando pizarra táctica con IDs de jugadores:", pizarraTactica)

      // Verificar si ya existe una pizarra para este evento
      const { data: pizarraExistente } = await supabase
        .from("pizarras_tacticas")
        .select("id")
        .eq("evento_id", eventoId)
        .maybeSingle()

      let error

      if (pizarraExistente) {
        // Actualizar la pizarra existente
        const { error: updateError } = await supabase
          .from("pizarras_tacticas")
          .update(pizarraTactica)
          .eq("id", pizarraExistente.id)

        error = updateError
      } else {
        // Crear una nueva pizarra
        const { error: insertError } = await supabase.from("pizarras_tacticas").insert([pizarraTactica])

        error = insertError
      }

      if (error) {
        console.error("Error al guardar la pizarra táctica:", error)
        alert("Error al guardar la pizarra táctica")
        return
      }

      alert("Pizarra táctica guardada correctamente")
    } catch (error) {
      console.error("Error al guardar la pizarra táctica:", error)
      alert("Error al guardar la pizarra táctica")
    }
  }

  // Modificar la función para mejorar la adaptabilidad en dispositivos móviles
  // Añadir esta función para recalcular posiciones cuando cambia el tamaño de la pantalla
  const recalcularPosicionesJugadores = () => {
    if (!eventoSeleccionado || !campoRef.current) return

    const idEvento = eventoSeleccionado.id
    const jugadoresDeEvento = jugadoresSeleccionadosPorEvento[idEvento] || []

    if (jugadoresDeEvento.length === 0) return

    // Obtener las dimensiones actuales del campo
    const campoWidth = campoRef.current.clientWidth
    const campoHeight = campoRef.current.clientHeight

    // Obtener las posiciones actuales
    const posicionesActuales = jugadoresPositions[idEvento] || {}

    // Crear nuevas posiciones ajustadas al tamaño actual
    const nuevasPosiciones: { [key: string]: { x: number; y: number } } = {}

    // Para cada jugador, ajustar su posición proporcionalmente al nuevo tamaño
    jugadoresDeEvento.forEach((jugador) => {
      const posActual = posicionesActuales[jugador.id]

      if (posActual) {
        // Si ya tiene una posición, ajustarla proporcionalmente
        // Asegurarse de que esté dentro de los límites del campo
        nuevasPosiciones[jugador.id] = {
          x: Math.min(Math.max(0, posActual.x), campoWidth - 60),
          y: Math.min(Math.max(0, posActual.y), campoHeight - 60),
        }
      } else {
        // Si no tiene posición, crear una nueva basada en una cuadrícula
        const index = jugadoresDeEvento.findIndex((j) => j.id === jugador.id)
        const cols = 3
        const marginX = 20
        const marginY = 20
        const cellWidth = (campoWidth - marginX * 2) / cols
        const row = Math.floor(index / cols)
        const col = index % cols

        nuevasPosiciones[jugador.id] = {
          x: marginX + col * cellWidth,
          y: marginY + row * 70,
        }
      }
    })

    // Actualizar las posiciones
    setJugadoresPositions((prev) => ({
      ...prev,
      [idEvento]: nuevasPosiciones,
    }))
  }

  // Añadir un efecto para detectar cambios en el tamaño de la ventana
  useEffect(() => {
    if (!eventoSeleccionado) return

    // Función para manejar el cambio de tamaño de la ventana
    const handleResize = () => {
      recalcularPosicionesJugadores()
    }

    // Agregar el event listener
    window.addEventListener("resize", handleResize)

    // Ejecutar una vez al montar para asegurar posiciones correctas
    recalcularPosicionesJugadores()

    // Limpiar el event listener al desmontar
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [eventoSeleccionado, jugadoresSeleccionadosPorEvento])

  // Modificar la función cargarPizarraTactica para mejorar la adaptabilidad
  // Modificar la función cargarPizarraTactica para evitar reinicializar posiciones guardadas
  const cargarPizarraTactica = async (eventoId: string) => {
    if (!eventoId) {
      console.log("No se puede cargar la pizarra: eventoId no disponible")
      return
    }

    try {
      console.log(`Cargando pizarra táctica para evento ${eventoId}`)

      const { data, error } = await supabase
        .from("pizarras_tacticas")
        .select("*")
        .eq("evento_id", eventoId)
        .maybeSingle()

      // Si hay un error que no sea "no se encontró registro", lo mostramos
      if (error && error.code !== "PGRST116") {
        console.error("Error al cargar la pizarra táctica:", error)
        return
      }

      if (data) {
        console.log("Pizarra táctica cargada:", data)

        // Cargar la formación
        setFormacionesPorEvento((prev) => ({
          ...prev,
          [eventoId]: data.formacion,
        }))

        // Cargar las posiciones - IMPORTANTE: Preservar estas posiciones y no recalcularlas
        const posicionesGuardadas = data.posiciones || {}
        setJugadoresPositions((prev) => ({
          ...prev,
          [eventoId]: posicionesGuardadas,
        }))

        // Ahora necesitamos manejar tanto arrays de IDs como arrays de objetos
        if (data.jugadores_seleccionados) {
          console.log(
            "Jugadores encontrados en la pizarra:",
            Array.isArray(data.jugadores_seleccionados) ? data.jugadores_seleccionados.length : "No es un array",
          )

          // Verificar si es un array de strings (IDs) o un array de objetos
          const esArrayDeIds =
            Array.isArray(data.jugadores_seleccionados) &&
            data.jugadores_seleccionados.length > 0 &&
            typeof data.jugadores_seleccionados[0] === "string"

          let jugadoresCompletos = []

          if (esArrayDeIds) {
            // Si son IDs, necesitamos buscar los jugadores completos
            console.log("Convirtiendo IDs a objetos de jugador completos")

            const idsJugadores = data.jugadores_seleccionados as string[]
            console.log("IDs de jugadores en la pizarra:", idsJugadores)

            // Primero, intentar cargar los perfiles que no tenemos
            const idsNoEncontrados = idsJugadores.filter((id) => !perfilesMap.has(id))

            if (idsNoEncontrados.length > 0) {
              console.log(`Intentando cargar ${idsNoEncontrados.length} perfiles adicionales...`)
              await cargarPerfilesPorIds(idsNoEncontrados)
            }

            // Ahora construir los jugadores completos usando el mapa de perfiles
            jugadoresCompletos = idsJugadores.map((id) => {
              // Buscar el jugador en el mapa de perfiles
              const jugador = perfilesMap.get(id)

              // Si lo encontramos, usarlo
              if (jugador) {
                return {
                  ...jugador,
                  seleccionado: true,
                }
              }

              // Si no lo encontramos, crear un jugador básico
              return {
                id,
                nombre: `Jugador ${id.substring(0, 4)}`,
                numero_polera: null,
                posicion: "Sin posición",
                seleccionado: true,
              }
            })

            console.log("Jugadores procesados para la pizarra:", jugadoresCompletos.length)
          } else if (Array.isArray(data.jugadores_seleccionados)) {
            // Si ya son objetos, usamos directamente la información guardada
            const jugadoresValidos = data.jugadores_seleccionados.filter((j: { id: any }) => j && j.id)

            // Usar directamente la información guardada en la pizarra
            jugadoresCompletos = jugadoresValidos.map((j: any) => ({
              ...j,
              seleccionado: true,
            }))

            // También actualizar el mapa de perfiles con esta información
            const nuevoMapa = new Map(perfilesMap)
            jugadoresValidos.forEach((jugador: Jugador): void => {
              // Solo actualizar si no existe o si tiene más información
              if (!nuevoMapa.has(jugador.id) || !nuevoMapa.get(jugador.id)?.nombre) {
                nuevoMapa.set(jugador.id, jugador)
              }
            })
            setPerfilesMap(nuevoMapa)
          }

          console.log("Jugadores procesados para mostrar:", jugadoresCompletos.length)

          setJugadoresSeleccionadosPorEvento((prev) => ({
            ...prev,
            [eventoId]: jugadoresCompletos,
          }))
        }

        // Marcar esta pizarra como cargada para evitar recalcular posiciones
        setPizarrasCargadas((prev) => ({
          ...prev,
          [eventoId]: true,
        }))

        // NO recalcular posiciones si ya tenemos posiciones guardadas
        // Solo ajustar si hay cambios en el tamaño de la pantalla
        if (Object.keys(posicionesGuardadas).length > 0) {
          console.log("Usando posiciones guardadas, no se recalculan")
        } else {
          console.log("No hay posiciones guardadas, inicializando posiciones predeterminadas")
          setTimeout(() => {
            inicializarPosicionesJugadores(eventoId)
          }, 500)
        }
      } else {
        // Si no hay datos, inicializamos con valores predeterminados
        console.log("No hay pizarra táctica guardada para este evento. Se usarán valores predeterminados.")

        // Inicializar la formación para este evento si no existe
        if (!formacionesPorEvento[eventoId]) {
          setFormacionesPorEvento((prev) => ({
            ...prev,
            [eventoId]: "4-4-2",
          }))
        }

        // Inicializar posiciones predeterminadas solo si no hay datos guardados
        setTimeout(() => {
          inicializarPosicionesJugadores(eventoId)
        }, 500)
      }
    } catch (err) {
      console.error("Error al cargar la pizarra táctica:", err)
    }
  }

  // Nueva función para inicializar posiciones de jugadores de manera más controlada
  const inicializarPosicionesJugadores = (eventoId: string) => {
    if (!campoRef.current) return

    const jugadoresDeEvento = jugadoresSeleccionadosPorEvento[eventoId] || []
    if (jugadoresDeEvento.length === 0) return

    // Verificar si ya tenemos posiciones guardadas para este evento
    const posicionesExistentes = jugadoresPositions[eventoId] || {}
    if (Object.keys(posicionesExistentes).length > 0) {
      console.log("Ya existen posiciones para este evento, ajustando al tamaño actual")
      ajustarPosicionesAlTamañoActual(eventoId, posicionesExistentes)
      return
    }

    console.log("Inicializando nuevas posiciones para los jugadores")

    // Obtener dimensiones del campo
    const campoWidth = campoRef.current.clientWidth
    const campoHeight = campoRef.current.clientHeight

    // Crear posiciones iniciales optimizadas para móvil y escritorio
    const newPositions: { [key: string]: { x: number; y: number } } = {}

    // Determinar si estamos en móvil o escritorio
    const esMobile = window.innerWidth < 768

    if (esMobile) {
      // En móvil, distribuir jugadores en más filas y menos columnas
      const cols = 2
      const rows = Math.ceil(jugadoresDeEvento.length / cols)

      // Calcular espaciado
      const marginX = campoWidth * 0.1
      const marginY = campoHeight * 0.1
      const cellWidth = (campoWidth - marginX * 2) / cols
      const cellHeight = (campoHeight - marginY * 2) / rows

      jugadoresDeEvento.forEach((jugador, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols

        newPositions[jugador.id] = {
          x: marginX + col * cellWidth + cellWidth / 2 - 30, // Centrar en la celda
          y: marginY + row * cellHeight + cellHeight / 2 - 30, // Centrar en la celda
        }
      })
    } else {
      // En escritorio, usar una distribución más espaciada
      const cols = 3
      const rows = Math.ceil(jugadoresDeEvento.length / cols)

      // Calcular espaciado
      const marginX = campoWidth * 0.1
      const marginY = campoHeight * 0.1
      const cellWidth = (campoWidth - marginX * 2) / cols
      const cellHeight = (campoHeight - marginY * 2) / rows

      jugadoresDeEvento.forEach((jugador, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols

        newPositions[jugador.id] = {
          x: marginX + col * cellWidth + cellWidth / 2 - 30, // Centrar en la celda
          y: marginY + row * cellHeight + cellHeight / 2 - 30, // Centrar en la celda
        }
      })
    }

    // Actualizar posiciones
    setJugadoresPositions((prev) => ({
      ...prev,
      [eventoId]: newPositions,
    }))
  }

  // Función para ajustar posiciones existentes al tamaño actual de la pantalla
  const ajustarPosicionesAlTamañoActual = (
    eventoId: string,
    posicionesExistentes: { [key: string]: { x: number; y: number } },
  ) => {
    if (!campoRef.current) return

    const campoWidth = campoRef.current.clientWidth
    const campoHeight = campoRef.current.clientHeight

    // Ajustar cada posición para asegurar que esté dentro de los límites
    const posicionesAjustadas: { [key: string]: { x: number; y: number } } = {}

    Object.entries(posicionesExistentes).forEach(([jugadorId, posicion]) => {
      // Asegurar que las posiciones estén dentro de los límites del campo
      posicionesAjustadas[jugadorId] = {
        x: Math.min(Math.max(0, posicion.x), campoWidth - 60),
        y: Math.min(Math.max(0, posicion.y), campoHeight - 60),
      }
    })

    // Actualizar posiciones
    setJugadoresPositions((prev) => ({
      ...prev,
      [eventoId]: posicionesAjustadas,
    }))
  }

  // Modificar el efecto de resize para usar las nuevas funciones
  useEffect(() => {
    if (!eventoSeleccionado) return

    const handleResize = () => {
      const idEvento = eventoSeleccionado.id
      const posicionesExistentes = jugadoresPositions[idEvento] || {}

      if (Object.keys(posicionesExistentes).length > 0) {
        // Si ya hay posiciones, ajustarlas al nuevo tamaño
        ajustarPosicionesAlTamañoActual(idEvento, posicionesExistentes)
      } else {
        // Si no hay posiciones, inicializarlas
        inicializarPosicionesJugadores(idEvento)
      }
    }

    // Ejecutar una vez al montar
    handleResize()

    // Agregar listener para cambios de tamaño
    window.addEventListener("resize", handleResize)

    // Limpiar
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [eventoSeleccionado, jugadoresSeleccionadosPorEvento])

  // Función para actualizar la suscripción a cambios en la pizarra táctica
  useEffect(() => {
    if (!eventoSeleccionado) return

    console.log(`Configurando suscripción para pizarra del evento ${eventoSeleccionado.id}`)

    // Crear una suscripción a cambios en la pizarra táctica
    const channel = supabase
      .channel(`pizarra-${eventoSeleccionado.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pizarras_tacticas",
          filter: `evento_id=eq.${eventoSeleccionado.id}`,
        },
        (payload) => {
          console.log("Cambios detectados en la pizarra táctica:", payload)

          // Recargar la pizarra táctica cuando haya cambios
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            console.log("Recargando pizarra táctica después de cambios")
            cargarPizarraTactica(eventoSeleccionado.id)
          }
        },
      )
      .subscribe((status) => {
        console.log(`Estado de la suscripción: ${status}`)
      })

    // Limpiar la suscripción al desmontar
    return () => {
      console.log(`Eliminando suscripción para pizarra del evento ${eventoSeleccionado.id}`)
      supabase.removeChannel(channel)
    }
  }, [eventoSeleccionado])

  // Añadir esta función para verificar las políticas de seguridad de Supabase
  const verificarPoliticasSeguridad = async () => {
    try {
      console.log("Verificando políticas de seguridad de Supabase...")

      // Intentar cargar un perfil específico para verificar permisos
      const { data, error } = await supabase.from("profiles").select("*").limit(1)

      if (error) {
        console.error("Error al verificar políticas de seguridad:", error)
        alert(
          "Es posible que haya restricciones de seguridad en la base de datos que impidan cargar perfiles de otros usuarios.",
        )
      } else {
        console.log("Verificación de políticas completada. Resultado:", data)
      }
    } catch (error) {
      console.error("Error al verificar políticas de seguridad:", error)
    }
  }

  // Función para depurar el estado de los jugadores en la pizarra
  const depurarEstadoJugadores = () => {
    if (!eventoSeleccionado) return

    const idEvento = eventoSeleccionado.id
    const jugadoresEvento = jugadoresSeleccionadosPorEvento[idEvento] || []
    const posicionesEvento = jugadoresPositions[idEvento] || {}

    console.log("=== DEPURACIÓN DE JUGADORES EN PIZARRA ===")
    console.log(`Evento: ${idEvento}`)
    console.log(`Número de jugadores seleccionados: ${jugadoresEvento.length}`)
    console.log(`Jugadores:`, jugadoresEvento)
    console.log(`Posiciones:`, posicionesEvento)
    console.log("==========================================")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-6 text-xl font-medium text-white">Cargando tu experiencia...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-foreground`}
    >
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="bg-white text-blue-600 p-2 rounded-full">
                <Trophy className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Deportivo Schaub</h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:block">
              <ul className="flex space-x-1">
                <li>
                  <button
                    onClick={() => setSeccionActiva("eventos")}
                    className={`px-5 py-2.5 rounded-lg transition-all duration-200 text-base font-medium ${
                      seccionActiva === "eventos" ? "bg-white text-blue-600 shadow-md" : "text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Partidos
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setSeccionActiva("crear-evento")}
                    className={`px-5 py-2.5 rounded-lg transition-all duration-200 text-base font-medium ${
                      seccionActiva === "crear-evento"
                        ? "bg-white text-blue-600 shadow-md"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Partido
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setSeccionActiva("perfil")}
                    className={`px-5 py-2.5 rounded-lg transition-all duration-200 text-base font-medium ${
                      seccionActiva === "perfil" ? "bg-white text-blue-600 shadow-md" : "text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Mi Perfil
                    </span>
                  </button>
                </li>
              </ul>
            </nav>

            {/* User Profile */}
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {darkMode ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                )}
              </button>

              {userProfile?.avatar_url ? (
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
                  <img
                    src={userProfile.avatar_url || "/placeholder.svg"}
                    alt={userProfile.nombre || "Usuario"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 bg-white text-blue-600 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white">
                  {userProfile?.nombre?.charAt(0) || user?.email?.charAt(0)}
                </div>
              )}

              <span className="font-medium">{userProfile?.nombre || user?.email}</span>

              <button
                onClick={handleSignOut}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm flex items-center transition-colors border border-white/20"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                Salir
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center space-x-2">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {darkMode ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                )}
              </button>
              <button
                className="text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="mt-3 md:hidden bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20 animate-fadeIn">
              <nav className="flex flex-col space-y-1">
                <button
                  onClick={() => {
                    setSeccionActiva("eventos")
                    setMobileMenuOpen(false)
                  }}
                  className={`px-4 py-3 rounded-lg text-left text-base transition-colors flex items-center ${
                    seccionActiva === "eventos"
                      ? "bg-white text-blue-600 font-medium shadow-sm"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <Calendar className="w-5 h-5 mr-3" />
                  Eventos
                </button>
                <button
                  onClick={() => {
                    setSeccionActiva("crear-evento")
                    setMobileMenuOpen(false)
                  }}
                  className={`px-4 py-3 rounded-lg text-left text-base transition-colors flex items-center ${
                    seccionActiva === "crear-evento"
                      ? "bg-white text-blue-600 font-medium shadow-sm"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <Plus className="w-5 h-5 mr-3" />
                  Crear Partido
                </button>
                <button
                  onClick={() => {
                    setSeccionActiva("perfil")
                    setMobileMenuOpen(false)
                  }}
                  className={`px-4 py-3 rounded-lg text-left text-base transition-colors flex items-center ${
                    seccionActiva === "perfil"
                      ? "bg-white text-blue-600 font-medium shadow-sm"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <User className="w-5 h-5 mr-3" />
                  Mi Perfil
                </button>

                <div className="h-px bg-white/20 my-1"></div>

                <div className="px-4 py-2 flex items-center text-white/80">
                  {userProfile?.avatar_url ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/50 mr-3">
                      <img
                        src={userProfile.avatar_url || "/placeholder.svg"}
                        alt={userProfile.nombre || "Usuario"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center text-sm font-bold border border-white/30 mr-3">
                      {userProfile?.nombre?.charAt(0) || user?.email?.charAt(0)}
                    </div>
                  )}
                  <span className="font-medium text-sm">{userProfile?.nombre || user?.email}</span>
                </div>

                <button
                  onClick={handleSignOut}
                  className="px-4 py-3 rounded-lg text-left text-base flex items-center text-white hover:bg-white/10 transition-colors"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Cerrar Sesión
                </button>
              </nav>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* SECCIÓN: EVENTOS */}
        {seccionActiva === "eventos" && (
          <section className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Próximos Partidos</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Organiza y gestiona tus eventos deportivos</p>
              </div>

              <button
                onClick={() => setSeccionActiva("crear-evento")}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-5 rounded-lg text-sm font-medium flex items-center transition-all duration-300 shadow-md hover:shadow-lg self-start md:self-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Evento
              </button>
            </div>

            {eventos.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center border border-gray-100 dark:border-gray-700">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">No hay eventos programados</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  Crea tu primer evento para comenzar a organizar tus partidos y entrenamientos.
                </p>
                <button
                  onClick={() => setSeccionActiva("crear-evento")}
                  className="mt-6 bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg text-sm font-medium inline-flex items-center transition-all duration-300"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Evento
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventos.map((evento) => (
                  <div
                    key={evento.id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group"
                  >
                    {/* Encabezado con título y tipo de evento */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mt-10 -mr-10 z-0"></div>
                      <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full -mb-6 -ml-6 z-0"></div>

                      <div className="flex justify-between items-start relative z-10">
                        <h3 className="font-bold text-xl truncate flex-1 group-hover:underline">{evento.titulo}</h3>
                        <span className="bg-white text-blue-600 text-xs font-bold px-2.5 py-1 rounded-full ml-2 whitespace-nowrap shadow-sm">
                          {evento.tipo || "Amistoso"}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center text-white/90 text-sm">
                        <CalendarDays className="w-4 h-4 mr-1.5" />
                        <span>
                          {new Date(evento.fecha).toLocaleDateString("es-ES", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Información principal */}
                    <div className="p-5">
                      {/* Hora y lugar destacados */}
                      <div className="flex flex-col sm:flex-row gap-3 mb-5">
                        <div className="flex-1 bg-blue-50 dark:bg-gray-700/50 rounded-xl p-3 flex items-center">
                          <div className="bg-blue-100 dark:bg-gray-700 rounded-full p-2 mr-3">
                            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Hora</p>
                            <p className="font-medium text-gray-800 dark:text-white">{evento.hora}</p>
                          </div>
                        </div>

                        <div className="flex-1 bg-blue-50 dark:bg-gray-700/50 rounded-xl p-3 flex items-center">
                          <div className="bg-blue-100 dark:bg-gray-700 rounded-full p-2 mr-3">
                            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Lugar</p>
                            <p className="font-medium text-gray-800 dark:text-white truncate max-w-[150px]">
                              {evento.lugar}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Estado del evento */}
                      <div className="mb-5">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Estado del partido
                          </span>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              evento.estado === "programado"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                : evento.estado === "confirmado"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : evento.estado === "cancelado"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {evento.estado || "Programado"}
                          </span>
                        </div>
                        <div
                          className={`w-full rounded-full h-2.5 ${
                            evento.estado === "programado"
                              ? "bg-blue-100 dark:bg-blue-900/30"
                              : evento.estado === "confirmado"
                                ? "bg-green-100 dark:bg-green-900/30"
                                : evento.estado === "cancelado"
                                  ? "bg-red-100 dark:bg-red-900/30"
                                  : "bg-gray-100 dark:bg-gray-700"
                          }`}
                        >
                          <div
                            className={`h-2.5 rounded-full ${
                              evento.estado === "programado"
                                ? "bg-blue-500 w-1/3"
                                : evento.estado === "confirmado"
                                  ? "bg-green-500 w-2/3"
                                  : evento.estado === "cancelado"
                                    ? "bg-red-500 w-full"
                                    : evento.estado === "finalizado"
                                      ? "bg-gray-500 w-full"
                                      : ""
                            }`}
                          ></div>
                        </div>
                      </div>

                      {/* Asistentes */}
                      <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mb-5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <div className="flex -space-x-2 mr-2">
                              {evento.asistentes.slice(0, 3).map((asistente, index) => {
                                const jugador = perfilesMap.get(asistente)
                                return (
                                  <div
                                    key={index}
                                    className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium overflow-hidden"
                                  >
                                    {jugador?.avatar_url ? (
                                      <img
                                        src={jugador.avatar_url || "/placeholder.svg"}
                                        alt={jugador.nombre || `Jugador ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span>{jugador?.nombre?.charAt(0) || asistente.charAt(0)}</span>
                                    )}
                                  </div>
                                )
                              })}
                              {evento.asistentes.length > 3 && (
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-300">
                                  +{evento.asistentes.length - 3}
                                </div>
                              )}
                            </div>
                            <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                              {evento.asistentes.length} asistentes
                            </span>
                          </div>

                          {evento.asistentes.includes(user.id) ? (
                            <span className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                              Asistirás
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full flex items-center">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1"></div>
                              No confirmado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => verDetalleEvento(evento)}
                          className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-2.5 px-4 rounded-lg text-sm font-medium flex-1 flex justify-center items-center transition-all duration-300 shadow-md hover:shadow-lg"
                        >
                          Ver detalles
                        </button>

                        <div className="flex gap-2 flex-1">
                          <button
                            onClick={() => handleAsistencia(evento.id, true)}
                            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                              evento.asistentes.includes(user.id)
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            Asistiré
                          </button>

                          <button
                            onClick={() => handleAsistencia(evento.id, false)}
                            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                              !evento.asistentes.includes(user.id)
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            No Asistiré
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECCIÓN: DETALLE DE EVENTO */}
        {seccionActiva === "detalle-evento" && eventoSeleccionado && (
          <section className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center">
                <button
                  onClick={volverAEventos}
                  className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium mr-4"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  <span className="hidden sm:inline">Volver a eventos</span>
                  <span className="sm:hidden">Volver</span>
                </button>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
                  {eventoSeleccionado.titulo}
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    eventoSeleccionado.estado === "programado"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : eventoSeleccionado.estado === "confirmado"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : eventoSeleccionado.estado === "cancelado"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {eventoSeleccionado.estado || "Programado"}
                </span>

                <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {eventoSeleccionado.tipo || "Amistoso"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Información principal del evento */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center">
                      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3 mr-4">
                        <CalendarDays className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Fecha</p>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {new Date(eventoSeleccionado.fecha).toLocaleDateString("es-ES", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3 mr-4">
                        <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Hora</p>
                        <p className="font-medium text-gray-800 dark:text-white">{eventoSeleccionado.hora}</p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3 mr-4">
                        <MapPin className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Lugar</p>
                        <p className="font-medium text-gray-800 dark:text-white">{eventoSeleccionado.lugar}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">Descripción</h3>
                    <p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      {eventoSeleccionado.descripcion || "No hay descripción disponible para este evento."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">Asistencia</h3>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleAsistencia(eventoSeleccionado.id, true)}
                        className={`py-2.5 px-5 rounded-lg text-sm font-medium flex items-center transition-all ${
                          eventoSeleccionado.asistentes.includes(user.id)
                            ? "bg-blue-600 text-white shadow-md hover:bg-blue-700"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${
                            eventoSeleccionado.asistentes.includes(user.id) ? "bg-white" : "bg-gray-400"
                          }`}
                        ></div>
                        Asistiré
                      </button>

                      <button
                        onClick={() => handleAsistencia(eventoSeleccionado.id, false)}
                        className={`py-2.5 px-5 rounded-lg text-sm font-medium flex items-center transition-all ${
                          !eventoSeleccionado.asistentes.includes(user.id)
                            ? "bg-red-600 text-white shadow-md hover:bg-red-700"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${
                            !eventoSeleccionado.asistentes.includes(user.id) ? "bg-white" : "bg-gray-400"
                          }`}
                        ></div>
                        No Asistiré
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pizarra táctica */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-5 flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    Pizarra Táctica
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                      <h4 className="font-medium text-gray-800 dark:text-white mb-3">Jugadores Disponibles</h4>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                        {todosLosJugadores.map((jugador) => (
                          <div
                            key={jugador.id}
                            className={`flex items-center p-2.5 mb-1.5 rounded-lg cursor-pointer transition-colors ${
                              (jugadoresSeleccionadosPorEvento[eventoSeleccionado.id] || []).find(
                                (j) => j.id === jugador.id,
                              )
                                ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                            onClick={() =>
                              eventoSeleccionado.asistentes.includes(user.id)
                                ? seleccionarJugador(jugador, eventoSeleccionado.id)
                                : null
                            }
                          >
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 shadow-sm">
                              {jugador.numero_polera || "?"}
                            </div>
                            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                              {jugador.nombre || `Jugador ${jugador.id.substring(0, 4)}`}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4">
                        <h4 className="font-medium text-gray-800 dark:text-white mb-3">Formación</h4>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={`px-3 py-2 text-sm rounded-lg font-medium ${
                              formacionesPorEvento[eventoSeleccionado.id] === "4-4-2"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            }`}
                            onClick={() =>
                              eventoSeleccionado.asistentes.includes(user.id)
                                ? cambiarFormacion("4-4-2", eventoSeleccionado.id)
                                : null
                            }
                            disabled={!eventoSeleccionado.asistentes.includes(user.id)}
                          >
                            4-4-2
                          </button>
                          <button
                            className={`px-3 py-2 text-sm rounded-lg font-medium ${
                              formacionesPorEvento[eventoSeleccionado.id] === "4-3-3"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            }`}
                            onClick={() =>
                              eventoSeleccionado.asistentes.includes(user.id)
                                ? cambiarFormacion("4-3-3", eventoSeleccionado.id)
                                : null
                            }
                            disabled={!eventoSeleccionado.asistentes.includes(user.id)}
                          >
                            4-3-3
                          </button>
                          <button
                            className={`px-3 py-2 text-sm rounded-lg font-medium ${
                              formacionesPorEvento[eventoSeleccionado.id] === "3-5-2"
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            }`}
                            onClick={() =>
                              eventoSeleccionado.asistentes.includes(user.id)
                                ? cambiarFormacion("3-5-2", eventoSeleccionado.id)
                                : null
                            }
                            disabled={!eventoSeleccionado.asistentes.includes(user.id)}
                          >
                            3-5-2
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div
                        ref={campoRef}
                        className="rounded-xl w-full h-96 relative overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
                        style={{
                          backgroundColor: "#4CAF50", // Green field color
                          backgroundImage:
                            "linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                      >
                        {/* Marcas del campo */}
                        <div className="absolute inset-0">
                          {/* Center circle */}
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white rounded-full opacity-80"></div>

                          {/* Center line */}
                          <div className="absolute top-1/2 left-0 right-0 transform -translate-y-1/2 border-t-2 border-white opacity-80"></div>

                          {/* Penalty areas */}
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-16 border-2 border-white rounded-b-lg opacity-80"></div>
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-40 h-16 border-2 border-white rounded-t-lg opacity-80"></div>

                          {/* Goal areas */}
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-6 border-2 border-white rounded-b-lg opacity-80"></div>
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-20 h-6 border-2 border-white rounded-t-lg opacity-80"></div>

                          {/* Penalty spots */}
                          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full opacity-80"></div>
                          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full opacity-80"></div>
                        </div>

                        {/* Jugadores arrastrables */}
                        {eventoSeleccionado && (
                          <div className="absolute inset-0 overflow-visible">
                            {Array.isArray(jugadoresSeleccionadosPorEvento[eventoSeleccionado.id]) ? (
                              jugadoresSeleccionadosPorEvento[eventoSeleccionado.id].map((jugador, index) => {
                                if (!jugador || !jugador.id) {
                                  console.log("Jugador inválido encontrado")
                                  return null
                                }

                                const perfilCompleto = perfilesMap.get(jugador.id) || jugador
                                const nombreMostrar = perfilCompleto.nombre || `Jugador ${jugador.id.substring(0, 4)}`
                                const numeroMostrar = perfilCompleto.numero_polera || "?"

                                // Obtener la posición del jugador o usar una posición predeterminada
                                const posiciones = jugadoresPositions[eventoSeleccionado.id] || {}
                                const posX = posiciones[jugador.id]?.x
                                const posY = posiciones[jugador.id]?.y

                                // Si no hay posición, usar posición basada en índice
                                const left = posX !== undefined ? `${posX}px` : `${(index % 3) * 80 + 20}px`
                                const top = posY !== undefined ? `${posY}px` : `${Math.floor(index / 3) * 80 + 20}px`

                                return (
                                  <div
                                    key={jugador.id}
                                    className="absolute w-16 h-16 z-10 rounded-full flex items-center justify-center"
                                    style={{
                                      left: left,
                                      top: top,
                                      cursor: eventoSeleccionado.asistentes.includes(user.id) ? "move" : "default",
                                      touchAction: "none",
                                      filter: "drop-shadow(0 4px 3px rgb(0 0 0 / 0.4))",
                                    }}
                                    onMouseDown={(e) =>
                                      eventoSeleccionado.asistentes.includes(user.id)
                                        ? handleDragStart(e, jugador.id)
                                        : null
                                    }
                                    onTouchStart={(e) =>
                                      eventoSeleccionado.asistentes.includes(user.id)
                                        ? handleTouchStart(e, jugador.id)
                                        : null
                                    }
                                  >
                                    <div className="w-14 h-14 bg-white rounded-full flex flex-col items-center justify-center shadow-lg border-2 border-blue-600 dark:border-blue-500 transform transition-transform hover:scale-110">
                                      <span className="text-lg font-bold text-blue-600 dark:text-blue-500">
                                        {numeroMostrar}
                                      </span>
                                    </div>
                                    <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full whitespace-nowrap shadow-md">
                                      {nombreMostrar}
                                    </span>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white bg-black/70 p-3 rounded-lg">
                                No hay jugadores seleccionados
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {eventoSeleccionado.asistentes.includes(user.id) && (
                        <div className="mt-4 flex flex-wrap justify-end gap-3">
                          <button
                            onClick={depurarEstadoJugadores}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 py-2 px-4 rounded-lg text-sm font-medium flex items-center transition-all"
                          >
                            <Activity className="w-4 h-4 mr-2" />
                            Depurar
                          </button>
                          <button
                            onClick={() => {
                              const idEvento = eventoSeleccionado.id
                              console.log("Forzando inicialización de jugadores")

                              // Seleccionar algunos jugadores por defecto (los primeros 11 asistentes)
                              const asistentes = eventoSeleccionado.asistentes || []
                              if (asistentes.length > 0) {
                                const jugadoresAsistentes = todosLosJugadores
                                  .filter((j) => asistentes.includes(j.id))
                                  .slice(0, 11)

                                if (jugadoresAsistentes.length > 0) {
                                  console.log(`Seleccionando ${jugadoresAsistentes.length} jugadores por defecto`)
                                  setJugadoresSeleccionadosPorEvento((prev) => ({
                                    ...prev,
                                    [idEvento]: jugadoresAsistentes,
                                  }))

                                  // Crear posiciones iniciales
                                  if (campoRef.current) {
                                    const campoWidth = campoRef.current.clientWidth || 300
                                    const campoHeight = campoRef.current.clientHeight || 400

                                    const newPositions: { [key: string]: { x: number; y: number } } = {}

                                    // Posicionar jugadores en una cuadrícula simple
                                    const cols = 3
                                    const marginX = 20
                                    const marginY = 20
                                    const cellWidth = (campoWidth - marginX * 2) / cols
                                    const cellHeight =
                                      (campoHeight - marginY * 2) / Math.ceil(jugadoresAsistentes.length / cols)

                                    jugadoresAsistentes.forEach((jugador, index) => {
                                      const row = Math.floor(index / cols)
                                      const col = index % cols

                                      newPositions[jugador.id] = {
                                        x: marginX + col * cellWidth,
                                        y: marginY + row * cellHeight,
                                      }
                                    })

                                    setJugadoresPositions((prev) => ({
                                      ...prev,
                                      [idEvento]: newPositions,
                                    }))
                                  }
                                }
                              }
                            }}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 py-2 px-4 rounded-lg text-sm font-medium flex items-center transition-all"
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            Inicializar Jugadores
                          </button>
                          <button
                            onClick={() => guardarPizarraTactica(eventoSeleccionado.id)}
                            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center transition-all duration-300 shadow-md hover:shadow-lg"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Guardar Pizarra
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Calificación de jugadores */}
                {eventoSeleccionado.asistentes.includes(user.id) && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-5 flex items-center">
                      <Award className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                      Calificar Jugadores
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {todosLosJugadores
                        .filter((j) => eventoSeleccionado.asistentes.includes(j.id) && j.id !== user.id)
                        .map((jugador) => (
                          <div
                            key={jugador.id}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex flex-col transition-all hover:shadow-md"
                          >
                            <div className="flex items-center mb-3">
                              {jugador.avatar_url ? (
                                <div className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2 border-white dark:border-gray-600 shadow-sm">
                                  <img
                                    src={jugador.avatar_url || "/placeholder.svg"}
                                    alt={jugador.nombre}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold mr-3 shadow-sm">
                                  {jugador.nombre?.charAt(0) || "J"}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-gray-800 dark:text-white">{jugador.nombre}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                                  <Shield className="w-3 h-3 mr-1" />
                                  {jugador.posicion || "Sin posición"}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-center mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => calificarJugador(jugador.id, star)}
                                  className="mx-1 focus:outline-none transform transition-transform hover:scale-110"
                                  aria-label={`Calificar con ${star} estrellas`}
                                >
                                  <Star
                                    className={`w-6 h-6 ${
                                      star <= (jugadoresCalificaciones[jugador.id] || 0)
                                        ? "text-yellow-400 fill-current"
                                        : "text-gray-300 dark:text-gray-600"
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Comentarios */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-5 flex items-center">
                    <MessageSquare className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    Comentarios
                  </h3>

                  <div className="space-y-4">
                    {comentarios.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                          <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 font-medium">
                          No hay comentarios aún. Sé el primero en comentar.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 mb-4">
                        {comentarios.map((comentario) => (
                          <div
                            key={comentario.id}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-sm transition-shadow"
                          >
                            <div className="flex justify-between items-center mb-3">
                              <div className="font-medium text-gray-800 dark:text-white flex items-center">
                                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-2">
                                  {comentario.usuario_nombre?.charAt(0) || "U"}
                                </div>
                                {comentario.usuario_nombre || "Usuario"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded-full">
                                {new Date(comentario.created_at).toLocaleString("es-ES", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300">{comentario.texto}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
                      <textarea
                        placeholder="Escribe un comentario..."
                        value={nuevoComentario}
                        onChange={(e) => setNuevoComentario(e.target.value)}
                        className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white resize-none"
                        rows={3}
                      ></textarea>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={enviarComentario}
                          className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-2.5 px-5 rounded-lg text-sm font-medium flex items-center transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!nuevoComentario.trim()}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Comentar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar - Lista de asistentes */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700 sticky top-24">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-5 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    Asistentes ({eventoSeleccionado.asistentes.length})
                  </h3>

                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    {todosLosJugadores
                      .filter((j) => eventoSeleccionado.asistentes.includes(j.id))
                      .map((jugador) => (
                        <div
                          key={jugador.id}
                          className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors"
                        >
                          {jugador.avatar_url ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden mr-3 border-2 border-white dark:border-gray-600 shadow-sm">
                              <img
                                src={jugador.avatar_url || "/placeholder.svg"}
                                alt={jugador.nombre}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 shadow-sm">
                              {jugador.nombre?.charAt(0) || jugador.id.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 dark:text-white truncate">
                              {jugador.nombre || `Jugador ${jugador.id.substring(0, 4)}`}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                              <Shield className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{jugador.posicion || "Sin posición"}</span>
                            </div>
                          </div>
                          <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-medium ml-2">
                            {jugador.numero_polera || "?"}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECCIÓN: CREAR EVENTO */}
        {seccionActiva === "crear-evento" && (
          <section>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Crear Nuevo Partido</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Completa el formulario para programar un nuevo evento
                </p>
              </div>

              <button
                onClick={() => setSeccionActiva("eventos")}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 py-2.5 px-5 rounded-lg text-sm font-medium flex items-center transition-all self-start md:self-auto"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Volver a eventos
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
              <form onSubmit={handleCrearEvento} className="space-y-6">
                <div>
                  <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Título del Partido
                  </label>
                  <input
                    type="text"
                    id="titulo"
                    value={nuevoEvento.titulo}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, titulo: e.target.value })}
                    required
                    placeholder="Ej: Partido amistoso vs Equipo Rival"
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      id="fecha"
                      value={nuevoEvento.fecha}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, fecha: e.target.value })}
                      required
                      className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="hora" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hora
                    </label>
                    <input
                      type="time"
                      id="hora"
                      value={nuevoEvento.hora}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, hora: e.target.value })}
                      required
                      className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lugar" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lugar
                  </label>
                  <input
                    type="text"
                    id="lugar"
                    value={nuevoEvento.lugar}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, lugar: e.target.value })}
                    required
                    placeholder="Ej: Cancha Municipal"
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tipo de Evento
                    </label>
                    <select
                      id="tipo"
                      value={nuevoEvento.tipo}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, tipo: e.target.value })}
                      required
                      className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                    >
                      <option value="amistoso">Amistoso</option>
                      <option value="oficial">Oficial</option>
                      <option value="entrenamiento">Entrenamiento</option>
                      <option value="torneo">Torneo</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="estado" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Estado
                    </label>
                    <select
                      id="estado"
                      value={nuevoEvento.estado}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, estado: e.target.value })}
                      required
                      className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                    >
                      <option value="programado">Programado</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="finalizado">Finalizado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="descripcion"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="descripcion"
                    value={nuevoEvento.descripcion}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, descripcion: e.target.value })}
                    placeholder="Detalles adicionales del partido..."
                    rows={4}
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white resize-none"
                  ></textarea>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-2.5 px-6 rounded-lg font-medium flex items-center transition-all duration-300 shadow-md hover:shadow-lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Crear Evento
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* SECCIÓN: PERFIL */}
        {seccionActiva === "perfil" && (
          <section>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Mi Perfil</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Gestiona tu información personal y estadísticas</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mt-20 -mr-20 z-0"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -mb-10 -ml-10 z-0"></div>

                <div className="flex flex-col md:flex-row items-center relative z-10">
                  <div className="mb-6 md:mb-0 md:mr-8">
                    {userProfile?.avatar_url ? (
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl">
                        <img
                          src={userProfile.avatar_url || "/placeholder.svg"}
                          alt={userProfile.nombre}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-white text-blue-600 rounded-full flex items-center justify-center text-5xl font-bold border-4 border-white shadow-xl">
                        {userProfile?.nombre?.charAt(0) || user?.email?.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="text-center md:text-left text-white">
                    <h3 className="text-2xl font-bold">{userProfile?.nombre || user?.email}</h3>
                    <p className="text-white/80 mb-4">{user?.email}</p>

                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                      {!editandoPerfil ? (
                        <button
                          onClick={() => setEditandoPerfil(true)}
                          className="bg-white text-blue-600 hover:bg-gray-100 py-2.5 px-5 rounded-lg text-sm font-medium flex items-center transition-all shadow-md hover:shadow-lg"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar Perfil
                        </button>
                      ) : (
                        <button
                          onClick={guardarPerfil}
                          className="bg-white text-blue-600 hover:bg-gray-100 py-2.5 px-5 rounded-lg text-sm font-medium flex items-center transition-all shadow-md hover:shadow-lg"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Guardar Cambios
                        </button>
                      )}

                      <button
                        onClick={handleSignOut}
                        className="bg-white/10 hover:bg-white/20 text-white py-2.5 px-5 rounded-lg text-sm font-medium flex items-center transition-all border border-white/20"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {editandoPerfil ? (
                  <div className="space-y-6 max-w-3xl mx-auto">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6 border border-blue-100 dark:border-blue-800">
                      <p className="text-blue-700 dark:text-blue-300 text-sm">
                        Completa tu perfil para que tus compañeros puedan identificarte mejor en los partidos.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="nombre"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Nombre
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        value={perfilEditable.nombre || ""}
                        onChange={(e) => setPerfilEditable({ ...perfilEditable, nombre: e.target.value })}
                        className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="numero_polera"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Número de Polera
                      </label>
                      <input
                        type="number"
                        id="numero_polera"
                        value={perfilEditable.numero_polera || ""}
                        onChange={(e) =>
                          setPerfilEditable({
                            ...perfilEditable,
                            numero_polera: Number.parseInt(e.target.value) || null,
                          })
                        }
                        className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="posicion"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Posición
                      </label>
                      <select
                        id="posicion"
                        value={perfilEditable.posicion || ""}
                        onChange={(e) => setPerfilEditable({ ...perfilEditable, posicion: e.target.value })}
                        className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                      >
                        <option value="">Selecciona una posición</option>
                        <option value="Portero">Portero</option>
                        <option value="Defensa">Defensa</option>
                        <option value="Mediocampista">Mediocampista</option>
                        <option value="Delantero">Delantero</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="avatar"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Foto de Perfil
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          id="avatar"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                        />

                        {perfilEditable.avatar_url && (
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600">
                            <img
                              src={perfilEditable.avatar_url || "/placeholder.svg"}
                              alt="Vista previa"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl flex items-center">
                        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3 mr-4">
                          <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Número de Polera</p>
                          <p className="text-xl font-medium text-gray-800 dark:text-white">
                            {userProfile?.numero_polera || "No asignado"}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl flex items-center">
                        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-3 mr-4">
                          <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Posición</p>
                          <p className="text-xl font-medium text-gray-800 dark:text-white">
                            {userProfile?.posicion || "No asignada"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-5 flex items-center">
                        <Trophy className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                        Mis Estadísticas
                      </h3>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">0</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Partidos</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">0</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Goles</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">0</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Asistencias</div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">0</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Tarjetas</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

