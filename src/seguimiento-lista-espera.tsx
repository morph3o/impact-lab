import { useState, useMemo } from "react";
import {
  MapPin, ClipboardCheck, FlaskConical, Stethoscope, CalendarCheck,
  CheckCircle2, AlertTriangle, Clock, Building2,
  LayoutGrid, UserRound, ArrowUpDown, ChevronDown, ChevronRight, X
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

// ---------- Generación de datos sintéticos (prototipo a escala) ----------
// Semilla fija para que la demo sea reproducible entre recargas.
function crearRng(semilla: number) {
  let s = semilla;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = crearRng(20260218);
const elegir = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const entero = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

const NOMBRES_PILA = [
  "Rosa", "Manuel", "Teresa", "Jorge", "Carmen", "Luis", "Ana", "Pedro",
  "María", "Francisco", "Patricia", "Juan", "Claudia", "Sergio", "Verónica",
  "Andrés", "Paola", "Ricardo", "Marcela", "Cristian", "Daniela", "Felipe",
  "Ximena", "Álvaro", "Isabel", "Gonzalo", "Soledad", "Rodrigo",
];
const APELLIDOS = [
  "Alarcón", "Zúñiga", "Vidal", "Painecura", "Soto", "Contreras", "Millán",
  "Escobar", "Rojas", "Fuentes", "Muñoz", "Sepúlveda", "Bravo", "Tapia",
  "Herrera", "Cárdenas", "Vergara", "Reyes", "Núñez", "Vásquez",
];
const PATOLOGIAS = [
  "Colecistectomía", "Hernia inguinal", "Cáncer de mama", "Catarata",
  "Prótesis de cadera", "Cáncer colorrectal", "Apendicectomía",
  "Estrabismo", "Fractura de cadera", "Cáncer gástrico",
];
const PRESTADORES: Array<{ prestador: string; servicio: string }> = [
  { prestador: "Hospital San Juan de Dios", servicio: "Metropolitano Occidente" },
  { prestador: "Hospital Barros Luco", servicio: "Metropolitano Sur" },
  { prestador: "Hospital San José", servicio: "Metropolitano Norte" },
  { prestador: "Hospital Van Buren", servicio: "Valparaíso" },
  { prestador: "Hospital Sótero del Río", servicio: "Metropolitano Sur Oriente" },
  { prestador: "Hospital Regional de Concepción", servicio: "Concepción" },
  { prestador: "Hospital Base de Valdivia", servicio: "Valdivia" },
];

// Distribución objetivo por celda (riesgo × estado de garantía), pensada para
// parecerse a la forma real: la mayoría vigente/riesgo bajo, pocos casos críticos.
const DISTRIBUCION: Array<{ riesgo: RiesgoClinico; estado: EstadoGarantia; cantidad: number }> = [
  { riesgo: "alto", estado: "vencida", cantidad: 6 },
  { riesgo: "alto", estado: "por_vencer", cantidad: 4 },
  { riesgo: "alto", estado: "vigente", cantidad: 16 },
  { riesgo: "medio", estado: "vencida", cantidad: 3 },
  { riesgo: "medio", estado: "por_vencer", cantidad: 6 },
  { riesgo: "medio", estado: "vigente", cantidad: 32 },
  { riesgo: "bajo", estado: "vencida", cantidad: 1 },
  { riesgo: "bajo", estado: "por_vencer", cantidad: 3 },
  { riesgo: "bajo", estado: "vigente", cantidad: 129 },
];

function generarDiasRestantes(estado: EstadoGarantia): number {
  if (estado === "vencida") return -entero(1, 150);
  if (estado === "por_vencer") return entero(0, 15);
  return entero(16, 180);
}

function generarPacientes(): Paciente[] {
  const pacientes: Paciente[] = [];
  let contador = 1000;
  for (const grupo of DISTRIBUCION) {
    for (let i = 0; i < grupo.cantidad; i++) {
      contador += 1;
      const { prestador, servicio } = elegir(PRESTADORES);
      const diasRestantes = generarDiasRestantes(grupo.estado);
      // La garantía deja de ser relevante una vez realizada la cirugía.
      const puedeEstarResuelto = grupo.estado === "vigente";
      const etapaIdx = puedeEstarResuelto && rng() < 0.05 ? 5 : entero(0, 4);
      const ingreso = -entero(1, 180);
      pacientes.push({
        id: `P-${contador}`,
        nombre: `${elegir(NOMBRES_PILA)} ${elegir(APELLIDOS)}`,
        patologia: elegir(PATOLOGIAS),
        prestador,
        servicio,
        etapaIdx,
        riesgo: grupo.riesgo,
        ingreso,
        plazoGarantia: diasRestantes,
        diasRestantes,
        estado: grupo.estado,
        diasEnEtapa: (Math.abs(ingreso) % 30) + 3,
      });
    }
  }
  return pacientes;
}

const PACIENTES: Paciente[] = generarPacientes();

const RIESGOS: RiesgoClinico[] = ["alto", "medio", "bajo"];
const ESTADOS: EstadoGarantia[] = ["vencida", "por_vencer", "vigente"];
const RIESGO_LABEL: Record<RiesgoClinico, string> = { alto: "Riesgo alto", medio: "Riesgo medio", bajo: "Riesgo bajo" };
const ESTADO_LABEL: Record<EstadoGarantia, string> = { vencida: "Vencidas", por_vencer: "Por vencer", vigente: "Vigentes" };
const ESTADO_COLOR: Record<EstadoGarantia, string> = { vencida: CORAL, por_vencer: AMBER, vigente: SAGE };
const ESTADO_BG: Record<EstadoGarantia, string> = { vencida: "#FBE6E2", por_vencer: "#FBF0DD", vigente: "#E7F3EC" };

const CELDA_ESTILO: Record<string, { bg: string; fg: string }> = {
  "alto-vencida": { bg: "#D6503D", fg: "#FFFFFF" },
  "alto-por_vencer": { bg: "#E8A98F", fg: "#FFFFFF" },
  "alto-vigente": { bg: "#F4D9CC", fg: INK },
  "medio-vencida": { bg: "#E8A98F", fg: "#FFFFFF" },
  "medio-por_vencer": { bg: "#B8790A", fg: "#FFFFFF" },
  "medio-vigente": { bg: "#F6E6C4", fg: INK },
  "bajo-vencida": { bg: "#F4D9CC", fg: INK },
  "bajo-por_vencer": { bg: "#F6E6C4", fg: INK },
  "bajo-vigente": { bg: "#DCEEE4", fg: INK },
};

const PESO_RIESGO: Record<RiesgoClinico, number> = { alto: 0, medio: 1, bajo: 2 };

function ordenarPacientes(lista: Paciente[], orden: string): Paciente[] {
  const l = [...lista];
  if (orden === "prioridad") {
    l.sort((a, b) => PESO_RIESGO[a.riesgo] - PESO_RIESGO[b.riesgo] || a.diasRestantes - b.diasRestantes);
  } else if (orden === "plazo") {
    l.sort((a, b) => a.diasRestantes - b.diasRestantes);
  } else if (orden === "etapa") {
    l.sort((a, b) => a.etapaIdx - b.etapaIdx);
  }
  return l;
}

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
type FiltroMatriz = { riesgo: RiesgoClinico; estado: EstadoGarantia };

function MatrizPrioridad({
  counts,
  filtro,
  onSeleccionar,
}: {
  counts: Record<string, number>;
  filtro: FiltroMatriz | null;
  onSeleccionar: (f: FiltroMatriz | null) => void;
}) {
  return (
    <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: CARD, border: `1px solid ${LINE}` }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: INK_SOFT }}>Mapa de prioridad</p>
          <p className="text-xs mt-0.5" style={{ color: INK_SOFT }}>Riesgo clínico × estado de garantía. Haz clic en una celda para filtrar la lista.</p>
        </div>
        {filtro && (
          <button
            onClick={() => onSeleccionar(null)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full shrink-0 cursor-pointer"
            style={{ backgroundColor: INK, color: "#FFFFFF" }}
          >
            <X size={12} /> Quitar filtro
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderSpacing: "6px 6px", borderCollapse: "separate" }}>
          <thead>
            <tr>
              <th></th>
              {ESTADOS.map((e) => (
                <th key={e} className="text-xs font-medium pb-1" style={{ color: INK_SOFT }}>
                  {ESTADO_LABEL[e]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RIESGOS.map((r) => (
              <tr key={r}>
                <th className="text-xs font-medium text-right pr-3 whitespace-nowrap" style={{ color: INK_SOFT }}>
                  {RIESGO_LABEL[r]}
                </th>
                {ESTADOS.map((e) => {
                  const key = `${r}-${e}`;
                  const count = counts[key] ?? 0;
                  const estilo = CELDA_ESTILO[key];
                  const activo = filtro?.riesgo === r && filtro?.estado === e;
                  return (
                    <td key={e} style={{ minWidth: 84 }}>
                      <button
                        onClick={() => onSeleccionar(activo ? null : { riesgo: r, estado: e })}
                        className="w-full rounded-lg py-3 text-center font-bold text-lg transition cursor-pointer"
                        style={{
                          backgroundColor: estilo.bg,
                          color: estilo.fg,
                          outline: activo ? `2px solid ${INK}` : "none",
                          outlineOffset: "2px",
                        }}
                        aria-pressed={activo}
                        aria-label={`${RIESGO_LABEL[r]}, ${ESTADO_LABEL[e]}: ${count} pacientes`}
                      >
                        {count}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TablaHeader() {
  return (
    <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: INK, color: "#FFFFFF" }}>
      <div className="col-span-3">Paciente</div>
      <div className="col-span-2">Prestador</div>
      <div className="col-span-3">Etapa actual</div>
      <div className="col-span-2">Garantía</div>
      <div className="col-span-2">Prioridad</div>
    </div>
  );
}

function FilaPaciente({ p, zebra }: { p: Paciente; zebra: boolean }) {
  const etapa = ETAPAS[p.etapaIdx];
  const Icon = etapa.icon;
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 py-3 text-sm items-center"
      style={{
        backgroundColor: zebra ? CARD : PAPER,
        borderTop: `1px solid ${LINE}`,
        borderLeft: `3px solid ${ESTADO_COLOR[p.estado]}`,
      }}
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
}

function SeccionHeader({
  estado,
  cantidad,
  abierta,
  onToggle,
}: {
  estado: EstadoGarantia;
  cantidad: number;
  abierta: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold cursor-pointer"
      style={{ backgroundColor: ESTADO_BG[estado], color: ESTADO_COLOR[estado] }}
      aria-expanded={abierta}
    >
      {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      {ESTADO_LABEL[estado]} ({cantidad})
    </button>
  );
}

function VistaCentral() {
  const [orden, setOrden] = useState<string>("prioridad");
  const [filtro, setFiltro] = useState<FiltroMatriz | null>(null);
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<EstadoGarantia, boolean>>({
    vencida: true,
    por_vencer: true,
    vigente: false,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of PACIENTES) {
      const key = `${p.riesgo}-${p.estado}`;
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  }, []);

  const listaFiltrada = useMemo(() => {
    if (!filtro) return [];
    return ordenarPacientes(
      PACIENTES.filter((p) => p.riesgo === filtro.riesgo && p.estado === filtro.estado),
      orden
    );
  }, [filtro, orden]);

  const pacientesPorEstado = useMemo(() => {
    const agrupado: Record<EstadoGarantia, Paciente[]> = { vencida: [], por_vencer: [], vigente: [] };
    for (const estado of ESTADOS) {
      agrupado[estado] = ordenarPacientes(PACIENTES.filter((p) => p.estado === estado), orden);
    }
    return agrupado;
  }, [orden]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm" style={{ color: INK_SOFT }}>{PACIENTES.length} pacientes en seguimiento</p>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: INK_SOFT }}>
          <ArrowUpDown size={14} /> Orden:
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
      </div>

      <MatrizPrioridad counts={counts} filtro={filtro} onSeleccionar={setFiltro} />

      {filtro ? (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
          <div className="px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: ESTADO_BG[filtro.estado], color: ESTADO_COLOR[filtro.estado] }}>
            {RIESGO_LABEL[filtro.riesgo]} · {ESTADO_LABEL[filtro.estado]} ({listaFiltrada.length})
          </div>
          <TablaHeader />
          {listaFiltrada.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: INK_SOFT }}>No hay pacientes en esta categoría.</div>
          ) : (
            listaFiltrada.map((p, i) => <FilaPaciente key={p.id} p={p} zebra={i % 2 === 0} />)
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {ESTADOS.map((estado) => {
            const lista = pacientesPorEstado[estado];
            const abierta = seccionesAbiertas[estado];
            return (
              <div key={estado} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
                <SeccionHeader
                  estado={estado}
                  cantidad={lista.length}
                  abierta={abierta}
                  onToggle={() => setSeccionesAbiertas((s) => ({ ...s, [estado]: !s[estado] }))}
                />
                {abierta && (
                  <>
                    <TablaHeader />
                    {lista.map((p, i) => <FilaPaciente key={p.id} p={p} zebra={i % 2 === 0} />)}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
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
