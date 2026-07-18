import type { Meta, StoryObj } from "@storybook/react";
import { Aviso } from "@ruum/ui";
import type { FotoEvidencia } from "@ruum/shared/types";
import { EvidenceCaptureStep } from "./EvidenceCaptureStep";
import type { EvidenceRequirement } from "./evidence-requirements";

const requirement: EvidenceRequirement = {
  angulo: "frente",
  titulo: "Frente",
  instruccion: "Toma el vehículo completo de frente antes de moverlo. Incluye placas y defensa.",
  guia: "Alinea la defensa dentro del marco.",
  obligatorio: true,
  permiteNoAplica: true,
};

const previewPhoto: FotoEvidencia = {
  id: "foto-storybook",
  traslado_id: "traslado-storybook",
  tipo: "inicial",
  angulo: "frente",
  url_visual:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%230D1626'/%3E%3Crect x='96' y='122' width='448' height='126' rx='48' fill='%23162238' stroke='%234DA3FF' stroke-width='8'/%3E%3Ccircle cx='210' cy='260' r='34' fill='%23101A2C' stroke='%238EC5FF' stroke-width='8'/%3E%3Ccircle cx='430' cy='260' r='34' fill='%23101A2C' stroke='%238EC5FF' stroke-width='8'/%3E%3Ctext x='320' y='92' text-anchor='middle' fill='%23E8EDF6' font-family='Arial' font-size='28'%3EEvidencia%3C/text%3E%3C/svg%3E",
  timestamp: "2026-07-18T10:00:00.000Z",
  sincronizada: true,
};

const pendingPhoto = {
  ...previewPhoto,
  id: "foto-pendiente-storybook",
  sincronizada: false,
};

const meta = {
  title: "Conductor/EvidenceCaptureStep",
  component: EvidenceCaptureStep,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
  args: {
    item: requirement,
    step: 1,
    total: 6,
    noAplica: false,
    busy: false,
    onCapture: () => undefined,
    onGallery: () => undefined,
    onNoAplica: () => undefined,
  },
} satisfies Meta<typeof EvidenceCaptureStep>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inicial: Story = {};

export const ConPrevisualizacion: Story = {
  args: {
    foto: previewPhoto,
  },
};

export const Error: Story = {
  render: (args) => (
    <div>
      <Aviso tono="danger">No pudimos abrir la cámara. Revisa permisos e intenta de nuevo.</Aviso>
      <EvidenceCaptureStep {...args} />
    </div>
  ),
};

export const Offline: Story = {
  args: {
    foto: pendingPhoto,
  },
  render: (args) => (
    <div>
      <Aviso tono="info">Sin conexión. La foto queda en cola local y se subirá al recuperar internet.</Aviso>
      <EvidenceCaptureStep {...args} />
    </div>
  ),
};

export const Sincronizando: Story = {
  args: {
    foto: pendingPhoto,
    busy: true,
  },
};

export const NoAplica: Story = {
  args: {
    noAplica: true,
    item: {
      ...requirement,
      titulo: "Daños preexistentes",
      instruccion: "Marca no aplica si no hay daños visibles antes de iniciar el traslado.",
      guia: "Acércate al daño y toma una foto clara.",
      obligatorio: false,
      permiteNoAplica: true,
    },
  },
};
