import { component, fields } from '@keystatic/core';
import { MotorArteTGP } from './MotorArteTGP';

export const componentBlocks = {
  nanoBananaImageBlock: component({
    label: 'Motor de Arte Nano Banana',
    schema: {
      conceptoBase: fields.text({ 
        label: 'Concepto Base (Español)', 
        description: 'La idea en español del usuario.'
      }),
      sujetoIA: fields.text({ 
        label: 'Sujeto IA (Inglés)', 
        multiline: true,
        description: 'Traducción/descripción en inglés generada por Gemini.'
      }),
      lineaEditorial: fields.select({
        label: 'Línea Editorial',
        options: [
          { label: 'Archivo Museo (Hasselblad Macro)', value: 'archivo-museo' },
          { label: 'Expedición 90s (Kodak Portra 35mm)', value: 'expedicion-90s' },
          { label: 'Dark Academia (Claroscuro Editorial)', value: 'dark-academia' },
        ],
        defaultValue: 'archivo-museo',
      }),
      usarManuales: fields.checkbox({
        label: 'Activar Overrides Manuales',
        defaultValue: false,
      }),
      overrideCamara: fields.text({ 
        label: 'Override Cámara',
        description: 'Anulación manual de técnica de cámara.'
      }),
      overrideIluminacion: fields.text({ 
        label: 'Override Iluminación',
        description: 'Anulación manual de esquema de iluminación.'
      }),
      overrideColor: fields.text({ 
        label: 'Override Color',
        description: 'Anulación manual de etalonaje y color.'
      }),
      imageUrl: fields.text({ 
        label: 'Imagen Materializada (URL)',
        description: 'La URL de la imagen generada (se actualiza automáticamente).'
      }),
    },
    preview: (props) => {
      return (
        <MotorArteTGP 
          value={props.fields.imageUrl.value} 
          onChange={(val: string) => {
            props.fields.imageUrl.onChange(val);
          }}
          initialTitulo={props.fields.conceptoBase.value || props.fields.sujetoIA.value}
        />
      );
    },
  }),
};
