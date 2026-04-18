import * as SecureStore from 'expo-secure-store';

const GEMINI_API_KEY_KEY = 'GEMINI_API_KEY';
const DEFAULT_API_KEY = 'AIzaSyCGXRqJJz4vbVAaroc8uwuH_YG6RzwF7uU';

export const saveApiKey = async (key: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(GEMINI_API_KEY_KEY, key);
  } catch (error) {
    console.error('Error saving API Key:', error);
    throw new Error('No se pudo guardar la API Key de forma segura.');
  }
};

export const getApiKey = async (): Promise<string | null> => {
  try {
    const key = await SecureStore.getItemAsync(GEMINI_API_KEY_KEY);
    // Si hay una key guardada, devuélvela, si no, usa la que el usuario nos ha pasado por defecto.
    return key || DEFAULT_API_KEY;
  } catch (error) {
    console.error('Error retrieving API Key:', error);
    // En caso de error leyendo SecureStore (raro), intentar usar el fallback.
    return DEFAULT_API_KEY;
  }
};

export const deleteApiKey = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(GEMINI_API_KEY_KEY);
  } catch (error) {
    console.error('Error deleting API Key:', error);
  }
};
