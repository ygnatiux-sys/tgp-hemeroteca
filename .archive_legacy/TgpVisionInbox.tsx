import React, { useState, useRef } from 'react';

interface TgpVisionInboxProps {
  onResponse?: (response: string) => void;
  onError?: (error: string) => void;
}

export const TgpVisionInbox: React.FC<TgpVisionInboxProps> = ({ onResponse, onError }) => {
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejo de archivo seleccionado
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // Conversión a Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remover el prefijo 'data:image/jpeg;base64,'
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile || !prompt.trim()) return;

    setIsLoading(true);
    try {
      const base64Data = await fileToBase64(imageFile);
      const mimeType = imageFile.type;

      // POST al backend (Hono)
      const res = await fetch('http://localhost:3001/api/vision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '2771' // TGP_MIND_API_KEY según entorno
        },
        body: JSON.stringify({
          prompt,
          base64: base64Data,
          mimeType
        })
      });

      if (!res.ok) {
        throw new Error('Error en la respuesta del servidor');
      }

      const data = await res.json();
      if (onResponse) onResponse(data.response);
      
      // Limpiar formulario tras éxito
      setPrompt('');
      setImageFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      if (onError) onError(error.message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0b0c10] text-[#c5c6c7] p-6 rounded-lg border border-[#1f2833] max-w-2xl mx-auto font-serif shadow-2xl">
      <h2 className="text-2xl mb-6 font-semibold tracking-wide text-white border-b border-[#1f2833] pb-2">
        TGP Scriptorium · Visión
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload de Imagen */}
        <div className="space-y-2">
          <label className="block text-sm uppercase tracking-widest text-[#66fcf1]">
            Documento Visual
          </label>
          <div className="relative border-2 border-dashed border-[#1f2833] rounded-md p-4 hover:border-[#45a29e] transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center pointer-events-none">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="mx-auto max-h-48 rounded shadow-md object-contain" />
              ) : (
                <div className="py-8 text-[#1f2833]">
                  <p>Arrastra una imagen o haz clic para seleccionar</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Input de Texto */}
        <div className="space-y-2">
          <label className="block text-sm uppercase tracking-widest text-[#66fcf1]">
            Prompt Analítico
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Introduce tu instrucción de análisis..."
            className="w-full bg-[#12141a] border border-[#1f2833] rounded-md p-4 text-[#c5c6c7] focus:outline-none focus:border-[#45a29e] transition-colors resize-y min-h-[120px] font-sans"
            required
          />
        </div>

        {/* Botón Submit */}
        <button
          type="submit"
          disabled={isLoading || !imageFile || !prompt.trim()}
          className="w-full bg-[#45a29e] text-[#0b0c10] font-bold uppercase tracking-widest py-3 rounded-md hover:bg-[#66fcf1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Analizando...' : 'Procesar Imagen'}
        </button>
      </form>
    </div>
  );
};
