import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Cargando...' }) => (
  <View className="flex-1 justify-center items-center bg-gray-900 px-6">
    <ActivityIndicator size="large" color="#3b82f6" />
    <Text className="text-gray-400 mt-4 text-lg text-center leading-6">{message}</Text>
  </View>
);

interface ErrorStateProps {
  message: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message }) => (
  <View className="flex-1 justify-center items-center bg-gray-900 px-6">
    <Text className="text-red-400 text-6xl mb-4">⚠️</Text>
    <Text className="text-white text-xl font-bold text-center mb-2">Ha ocurrido un error</Text>
    <Text className="text-gray-400 text-center">{message}</Text>
  </View>
);

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, actionLabel, onAction }) => (
  <View className="flex-1 justify-center items-center bg-gray-900 px-6">
    <Text className="text-gray-500 text-6xl mb-4">📅</Text>
    <Text className="text-gray-400 text-lg text-center mb-6">{message}</Text>
  </View>
);
