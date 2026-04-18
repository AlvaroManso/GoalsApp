/**
 * Sanitiza la respuesta de la IA (Gemini) eliminando bloques de markdown.
 * Busca un patrón de bloque de código JSON y extrae solo su contenido.
 * Si no encuentra el patrón, devuelve el texto original asumiendo que ya es JSON puro.
 */
export const parseAIResponse = (text: string): any => {
  try {
    // 1. Intentar limpiar bloques markdown (```json ... ``` o ``` ... ```)
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = text.match(jsonBlockRegex);
    
    let cleanText = text;
    
    if (match && match[1]) {
      cleanText = match[1];
    } else {
      // 2. Fallback: eliminar espacios en blanco al inicio y al final
      cleanText = text.trim();
    }
    
    // 3. Parsear el JSON sanitizado
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Error parseando la respuesta de Gemini:', error);
    console.error('Texto original recibido:', text);
    throw new Error('La IA no devolvió un formato JSON válido.');
  }
};
