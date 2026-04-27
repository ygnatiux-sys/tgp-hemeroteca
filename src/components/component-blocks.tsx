import { component, fields } from '@keystatic/core';
import { MotorArteTGP } from './MotorArteTGP';

export const componentBlocks = {
  nanoBananaImageBlock: component({
    label: 'Motor de Arte Nano Banana',
    schema: {
      direccionArte: fields.text({ 
        label: 'Dirección de Arte (Prompt)', 
        multiline: true,
        description: 'El prompt maestro generado o editado manualmente.'
      }),
      imageUrl: fields.text({ 
        label: 'Imagen Materializada (URL)',
        description: 'La URL de la imagen generada (se actualiza automáticamente).'
      }),
      concept: fields.text({
        label: 'Concepto Original',
        description: 'El concepto base para la generación.'
      }),
    },
    preview: (props) => {
      return (
        <MotorArteTGP 
          value={props.fields.imageUrl.value} 
          onChange={(val: string) => {
            props.fields.imageUrl.onChange(val);
          }}
          initialTitulo={props.fields.concept.value}
          // Nota: El componente MotorArteTGP tiene su propia lógica interna para llamar a la API
        />
      );
    },
  }),
};
