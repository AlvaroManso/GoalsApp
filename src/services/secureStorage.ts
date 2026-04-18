import * as SecureStore from 'expo-secure-store';

const GEMINI_API_KEY_KEY = 'GEMINI_API_KEY';

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
    return await SecureStore.getItemAsync(GEMINI_API_KEY_KEY);
  } catch (error) {
    console.error('Error retrieving API Key:', error);
    return null;
  }
};

export const deleteApiKey = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(GEMINI_API_KEY_KEY);
  } catch (error) {
    console.error('Error deleting API Key:', error);
  }
};
