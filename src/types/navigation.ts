import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: undefined;
  CheckIn: undefined;
  MainTabs: undefined;
  Tracker: { activityType?: string } | undefined;
  Profile: undefined;
};

export type BottomTabParamList = {
  Dashboard: undefined;
  Calendar: undefined;
  TrackerTab: undefined;
  History: undefined;
  Chat: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

// Para tipar las pantallas dentro del Tab Navigator que pueden hacer push al Stack (como abrir Tracker)
export type TabScreenProps<T extends keyof BottomTabParamList> = 
  CompositeScreenProps<
    BottomTabScreenProps<BottomTabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;
