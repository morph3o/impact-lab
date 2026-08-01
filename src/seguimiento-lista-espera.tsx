import { useState, useMemo } from "react";
import {
  MapPin, ClipboardCheck, FlaskConical, Stethoscope, CalendarCheck,
  CheckCircle2, AlertTriangle, Clock, Building2,
  LayoutGrid, UserRound, Filter, ArrowUpDown
} from "lucide-react";

// ---------- Diseño ----------
// Base: blanco frío / Tinta: verde-marino profundo (confianza clínica, no genérico)
// Alerta: coral saturado (vencida) · ámbar (por vencer) · verde salvia (vigente)
// Firma: el "camino" del paciente — stepper horizontal tipo vía/trayecto,
// porque la queja central era literalmente "no sé en qué paso estoy".

const INK = "#12312B";
const INK_SOFT = "#2F5148";
const PAPER = "#F6F8F7";
const CARD = "#FFFFFF";
const LINE = "#DFE7E3";
const CORAL = "#D6503D";
const AMBER = "#B8790A";
const SAGE = "#2E7D5B";

type EtapaKey = "diagnostico" | "garantia" | "examenes" | "anestesia" | "agendado" | "resuelto";
type EstadoGarantia = "vigente" | "por_vencer" | "vencida";
type RiesgoClinico = "alto" | "medio" | "bajo";

interface Paciente {
  id: string;
  nombre: string;
  patologia: string;
  prestador: string;
  servicio: string;
  etapaIdx: number;
  riesgo: RiesgoClinico;
  ingreso: number;
  plazoGarantia: number;
  diasRestantes: number;
  estado: EstadoGarantia;
  diasEnEtapa: number;
}

const ETAPAS: Array<{ key: EtapaKey; label: string; icon: React.ElementType }> = [
  { key: "diagnostico", label: "Diagnóstico confirmado", icon: ClipboardCheck },
  { key: "garantia", label: "Garantía GES activada", icon: MapPin },
  { key: "examenes", label: "Exámenes prequirúrgicos", icon: FlaskConical },
  { key: "anestesia", label: "Evaluación anestésica", icon: Stethoscope },
  { key: "agendado", label: "Agendado a pabellón", icon: CalendarCheck },
  { key: "resuelto", label: "Cirugía realizada", icon: CheckCircle2 },
];

const RESPONSABLES: Record<EtapaKey, string> = {
  diagnostico: "Médico tratante",
  garantia: "Unidad GES / FONASA",
  examenes: "Enfermera coordinadora",
  anestesia: "Equipo de anestesiología",
  agendado: "Pabellón central",
  resuelto: "—",
};

const QUE_SIGUE: Record<EtapaKey, string> = {
  diagnostico: "Se activará tu garantía GES y comenzará el conteo de plazos.",
  garantia: "Se coordinarán tus exámenes previos a la cirugía.",
  examenes: "Con tus exámenes listos, pasas a evaluación con anestesiología.",
  anestesia: "Aprobada la evaluación, se te asignará fecha de pabellón.",
  agendado: "Tu cirugía está agendada. Recibirás confirmación e instrucciones previas.",
  resuelto: "Tu proceso quirúrgico fue completado.",
};

const PACIENTES_RAW: Array<{
  id: string;
  nombre: string;
  patologia: string;
  prestador: string;
  servicio: string;
  etapaIdx: number;
  riesgo: RiesgoClinico;
  ingreso: number;
  plazoGarantia: number;
}> = [
  { id: "P-1042", nombre: "Rosa Alarcón", patologia: "Colecistectomía", prestador: "Hospital San Juan de Dios", servicio: "Metropolitano Occidente", etapaIdx: 2, riesgo: "medio", ingreso: -95, plazoGarantia: -95 + 90 },
  { id: "P-1043", nombre: "Manuel Zúñiga", patologia: "Hernia inguinal", prestador: "Hospital Barros Luco", servicio: "Metropolitano Sur", etapaIdx: 1, riesgo: "bajo", ingreso: -60, plazoGarantia: -60 + 120 },
  { id: "P-1044", nombre: "Teresa Vidal", patologia: "Cáncer de mama", prestador: "Hospital San José", servicio: "Metropolitano Norte", etapaIdx: 3, riesgo: "alto", ingreso: -40, plazoGarantia: -40 + 45 },
  { id: "P-1045", nombre: "Jorge Painecura", patologia: "Catarata", prestador: "Hospital Van Buren", servicio: "Valparaíso", etapaIdx: 0, riesgo: "bajo", ingreso: -10, plazoGarantia: -10 + 180 },
  { id: "P-1046", nombre: "Carmen Soto", patologia: "Prótesis de cadera", prestador: "Hospital Sótero del Río", servicio: "Metropolitano Sur Oriente", etapaIdx: 2, riesgo: "alto", ingreso: -130, plazoGarantia: -130 + 120 },
  { id: "P-1047", nombre: "Luis Contreras", patologia: "Colecistectomía", prestador: "Hospital San Juan de Dios", servicio: "Metropolitano Occidente", etapaIdx: 4, riesgo: "medio", ingreso: -70, plazoGarantia: -70 + 90 },
  { id: "P-1048", nombre: "Ana Millán", patologia: "Hernia inguinal", prestador: "Hospital Barros Luco", servicio: "Metropolitano Sur", etapaIdx: 1, riesgo: "medio", ingreso: -115, plazoGarantia: -115 + 120 },
  { id: "P-1049", nombre: "Pedro Escobar", patologia: "Cáncer colorrectal", prestador: "Hospital San José", servicio: "Metropolitano Norte", etapaIdx: 2, riesgo: "alto", ingreso: -30, plazoGarantia: -30 + 30 },
];

const PACIENTES: Paciente[] = PACIENTES_RAW.map((p) => {
  const diasRestantes = p.plazoGarantia;
  let estado: EstadoGarantia = "vigente";
  if (diasRestantes < 0) estado = "vencida";
  else if (diasRestantes <= 15) estado = "por_vencer";
  return { ...p, diasRestantes, estado, diasEnEtapa: Math.abs(p.ingreso) % 30 + 3 };
});

function EstadoBadge({ estado }: { estado: EstadoGarantia }) {
  const map = {
    vigente: { bg: "#E7F3EC", fg: SAGE, label: "Vigente" },
    por_vencer: { bg: "#FBF0DD", fg: AMBER, label: "Por vencer" },
    vencida: { bg: "#FBE6E2", fg: CORAL, label: "Vencida" },
  };
  const s = map[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.fg }} />
      {s.label}
    </span>
  );
}

function RiesgoTag({ riesgo }: { riesgo: RiesgoClinico }) {
  const map = {
    alto: { fg: CORAL, label: "Riesgo alto" },
    medio: { fg: AMBER, label: "Riesgo medio" },
    bajo: { fg: SAGE, label: "Riesgo bajo" },
  };
  const s = map[riesgo];
  return (
    <span className="text-xs font-medium" style={{ color: s.fg }}>
      {s.label}
    </span>
  );
}

// ---------- Vista paciente ----------
function VistaPaciente() {
  const [selId, setSelId] = useState(PACIENTES[0].id);
  const paciente = PACIENTES.find((p) => p.id === selId) ?? PACIENTES[0];
  const etapa = ETAPAS[paciente.etapaIdx];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>
          Demo — selecciona un paciente
        </label>
        <select
          value={selId}
          onChange={(e) => setSelId(e.target.value)}
          className="w-full rounded-lg border px-3 py-2.5 text-sm font-medium bg-white"
          style={{ borderColor: LINE, color: INK }}
        >
          {PACIENTES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {p.patologia}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl p-6" style={{ backgroundColor: CARD, border: `1px solid ${LINE}` }}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-xl font-bold" style={{ color: INK }}>{paciente.nombre}</h2>
            <p className="text-sm" style={{ color: INK_SOFT }}>{paciente.patologia} · {paciente.prestador}</p>
          </div>
          <EstadoBadge estado={paciente.estado} />
        </div>

        {paciente.estado === "vencida" && (
          <div className="mt-4 flex items-start gap-2 rounded-lg p-3 text-sm" style={{ backgroundColor: "#FBE6E2", color: CORAL }}>
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>Tu garantía de oportunidad venció hace {Math.abs(paciente.diasRestantes)} días. Tu caso fue escalado para priorización inmediata.</span>
          </div>
        )}
        {paciente.estado === "por_vencer" && (
          <div className="mt-4 flex items-start gap-2 rounded-lg p-3 text-sm" style={{ backgroundColor: "#FBF0DD", color: AMBER }}>
            <Clock size={18} className="shrink-0 mt-0.5" />
            <span>Quedan {paciente.diasRestantes} días de tu garantía. Estamos gestionando tu siguiente paso con prioridad.</span>
          </div>
        )}

        {/* Camino / stepper */}
        <div className="mt-8">
          <div className="relative">
            <div className="absolute left-0 right-0 top-4 h-0.5" style={{ backgroundColor: LINE }} />
            <div
              className="absolute left-0 top-4 h-0.5 transition-all"
              style={{ width: `${(paciente.etapaIdx / (ETAPAS.length - 1)) * 100}%`, backgroundColor: INK }}
            />
            <div className="relative flex justify-between">
              {ETAPAS.map((e, i) => {
                const Icon = e.icon;
                const done = i < paciente.etapaIdx;
                const current = i === paciente.etapaIdx;
                return (
                  <div key={e.key} className="flex flex-col items-center" style={{ width: `${100 / ETAPAS.length}%` }}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                      style={{
                        backgroundColor: done || current ? INK : CARD,
                        borderColor: done || current ? INK : LINE,
                      }}
                    >
                      <Icon size={15} color={done || current ? "#FFFFFF" : INK_SOFT} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-center text-sm font-semibold mt-3" style={{ color: INK }}>
            {etapa.label}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <div className="rounded-lg p-3.5" style={{ backgroundColor: PAPER }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Qué sigue</p>
            <p className="text-sm" style={{ color: INK }}>{QUE_SIGUE[etapa.key]}</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg p-3.5" style={{ backgroundColor: PAPER }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Responsable</p>
              <p className="text-sm font-medium" style={{ color: INK }}>{RESPONSABLES[etapa.key]}</p>
            </div>
            <div className="flex-1 rounded-lg p-3.5" style={{ backgroundColor: PAPER }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Plazo de garantía</p>
              <p className="text-sm font-medium" style={{ color: INK }}>
                {paciente.diasRestantes >= 0 ? `${paciente.diasRestantes} días restantes` : `Vencida hace ${Math.abs(paciente.diasRestantes)} días`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Vista central ----------
function VistaCentral() {
  const [filtro, setFiltro] = useState<string>("todos");
  const [orden, setOrden] = useState<string>("prioridad");

  const resumen = useMemo(() => {
    const vencidas = PACIENTES.filter((p) => p.estado === "vencida").length;
    const porVencer = PACIENTES.filter((p) => p.estado === "por_vencer").length;
    const riesgoAlto = PACIENTES.filter((p) => p.riesgo === "alto").length;
    return { total: PACIENTES.length, vencidas, porVencer, riesgoAlto };
  }, []);

  const lista = useMemo(() => {
    let l = [...PACIENTES];
    if (filtro !== "todos") l = l.filter((p) => p.estado === filtro);
    if (orden === "prioridad") {
      const pesoRiesgo: Record<RiesgoClinico, number> = { alto: 0, medio: 1, bajo: 2 };
      l.sort((a, b) => pesoRiesgo[a.riesgo] - pesoRiesgo[b.riesgo] || a.diasRestantes - b.diasRestantes);
    } else if (orden === "plazo") {
      l.sort((a, b) => a.diasRestantes - b.diasRestantes);
    } else if (orden === "etapa") {
      l.sort((a, b) => a.etapaIdx - b.etapaIdx);
    }
    return l;
  }, [filtro, orden]);

  return (
    <div>
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ backgroundColor: CARD, border: `1px solid ${LINE}` }}>
          <p className="text-2xl font-bold" style={{ color: INK }}>{resumen.total}</p>
          <p className="text-xs mt-1" style={{ color: INK_SOFT }}>Pacientes en seguimiento</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "#FBE6E2" }}>
          <p className="text-2xl font-bold" style={{ color: CORAL }}>{resumen.vencidas}</p>
          <p className="text-xs mt-1" style={{ color: CORAL }}>Garantías vencidas</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "#FBF0DD" }}>
          <p className="text-2xl font-bold" style={{ color: AMBER }}>{resumen.porVencer}</p>
          <p className="text-xs mt-1" style={{ color: AMBER }}>Por vencer (≤15 días)</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: CARD, border: `1px solid ${LINE}` }}>
          <p className="text-2xl font-bold" style={{ color: INK }}>{resumen.riesgoAlto}</p>
          <p className="text-xs mt-1" style={{ color: INK_SOFT }}>Riesgo clínico alto</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: INK_SOFT }}>
          <Filter size={14} /> Estado:
        </div>
        {[
          ["todos", "Todos"],
          ["vencida", "Vencidas"],
          ["por_vencer", "Por vencer"],
          ["vigente", "Vigentes"],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltro(val)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition"
            style={{
              backgroundColor: filtro === val ? INK : CARD,
              color: filtro === val ? "#FFFFFF" : INK_SOFT,
              border: `1px solid ${filtro === val ? INK : LINE}`,
            }}
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 text-xs font-semibold ml-2" style={{ color: INK_SOFT }}>
          <ArrowUpDown size={14} /> Orden:
        </div>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-white"
          style={{ border: `1px solid ${LINE}`, color: INK }}
        >
          <option value="prioridad">Prioridad clínica</option>
          <option value="plazo">Plazo de garantía</option>
          <option value="etapa">Etapa actual</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
        <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: INK, color: "#FFFFFF" }}>
          <div className="col-span-3">Paciente</div>
          <div className="col-span-2">Prestador</div>
          <div className="col-span-3">Etapa actual</div>
          <div className="col-span-2">Garantía</div>
          <div className="col-span-2">Prioridad</div>
        </div>
        {lista.map((p, i) => {
          const etapa = ETAPAS[p.etapaIdx];
          const Icon = etapa.icon;
          return (
            <div
              key={p.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 py-3 text-sm items-center"
              style={{ backgroundColor: i % 2 === 0 ? CARD : PAPER, borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}
            >
              <div className="sm:col-span-3">
                <p className="font-semibold" style={{ color: INK }}>{p.nombre}</p>
                <p className="text-xs" style={{ color: INK_SOFT }}>{p.patologia} · {p.id}</p>
              </div>
              <div className="sm:col-span-2 flex items-center gap-1.5 text-xs" style={{ color: INK_SOFT }}>
                <Building2 size={13} className="shrink-0" />
                <span className="truncate">{p.servicio}</span>
              </div>
              <div className="sm:col-span-3 flex items-center gap-2">
                <Icon size={15} style={{ color: INK_SOFT }} />
                <span style={{ color: INK }}>{etapa.label}</span>
              </div>
              <div className="sm:col-span-2">
                <EstadoBadge estado={p.estado} />
              </div>
              <div className="sm:col-span-2">
                <RiesgoTag riesgo={p.riesgo} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SeguimientoListaEspera() {
  const [vista, setVista] = useState<"central" | "paciente">("central");

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAPER, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>

      <header className="sticky top-0 z-10" style={{ backgroundColor: INK }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide" style={{ color: "#9CC4B4" }}>SEGUIMIENTO DE LISTA DE ESPERA</p>
            <h1 className="text-lg font-bold text-white">Mi Camino Quirúrgico</h1>
          </div>
          <div className="flex rounded-full p-1" style={{ backgroundColor: "#1F473F" }}>
            <button
              onClick={() => setVista("central")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer"
              style={{ backgroundColor: vista === "central" ? "#FFFFFF" : "transparent", color: vista === "central" ? INK : "#CFE3DA" }}
            >
              <LayoutGrid size={14} /> Equipo central
            </button>
            <button
              onClick={() => setVista("paciente")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer"
              style={{ backgroundColor: vista === "paciente" ? "#FFFFFF" : "transparent", color: vista === "paciente" ? INK : "#CFE3DA" }}
            >
              <UserRound size={14} /> Vista paciente
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {vista === "central" ? <VistaCentral /> : <VistaPaciente />}
      </main>
    </div>
  );
}
