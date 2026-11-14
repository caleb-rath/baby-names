import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View, useColorScheme, useWindowDimensions } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation, type LinkingOptions, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import WelcomeScreen from '../screens/WelcomeScreen';
import ShareCodeScreen from '../screens/ShareCodeScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import DeckScreen from '../screens/DeckScreen';
import CouchScreen from '../screens/CouchScreen';
import OurNamesScreen from '../screens/OurNamesScreen';
import NameScreen from '../screens/NameScreen';
import AddNameScreen from '../screens/AddNameScreen';
import MyAnswersScreen from '../screens/MyAnswersScreen';
import ThisOrThatScreen from '../screens/ThisOrThatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useStore } from '../store/useStore';
import { useOurNames } from '../store/hooks';
import { clearUrlParams, inviteCodeFromUrl, onResume } from '../lib/platform';
import { font, useTheme } from '../theme';
import { MAX_WIDTH } from '../components/ui';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Each screen gets its own address, so opening one adds a browser history entry
// and Android's back gesture goes back a screen instead of closing the app.
const linking: LinkingOptions<any> = {
  prefixes: [],
  config: {
    screens: {
      Welcome: 'welcome',
      ShareCode: 'invite',
      Main: { path: '', screens: { Discover: '', OurNames: 'names' } },
      Deck: 'deck/:packId',
      Couch: 'couch',
      Name: 'name/:itemId',
      AddName: 'add',
      MyAnswers: 'answers',
      ThisOrThat: 'this-or-that',
      Settings: 'settings',
    },
  },
};

function MainTabs() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const { width } = useWindowDimensions();
  const newCount = useOurNames().filter((n) => n.isNew).length;

  // A "Couch mode?" text link opens straight into the game.
  // An invite link opened by someone who already started their own list offers to join that one instead.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof location === 'undefined') return;
    const couch = new URLSearchParams(location.search).get('couch');
    const code = inviteCodeFromUrl()?.toUpperCase();
    if (!couch && !code) return;
    clearUrlParams();
    const session = useStore.getState().session;
    if (couch) nav.navigate('Couch');
    else if (code && session && !session.partner && code !== session.code) nav.navigate('Settings', { code });
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icon = route.name === 'Discover' ? (focused ? 'albums' : 'albums-outline') : focused ? 'heart' : 'heart-outline';
          return <Ionicons name={icon} size={size} color={color} />;
        },
        tabBarActiveTintColor: t.coral,
        tabBarInactiveTintColor: t.muted,
        // Side padding keeps the two tabs together on the unfolded Fold instead of 900px apart.
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line, height: Platform.OS === 'web' ? 64 : undefined, paddingHorizontal: Math.max(0, (width - MAX_WIDTH) / 2) },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 12 },
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="OurNames" component={OurNamesScreen} options={{ title: 'Our names', tabBarBadge: newCount || undefined, tabBarBadgeStyle: { backgroundColor: t.coral, fontFamily: font.bold } }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const t = useTheme();
  const scheme = useColorScheme();
  const session = useStore((s) => s.session);
  const justCreated = useStore((s) => s.justCreated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => {
      useStore.getState().init().finally(() => setReady(true));
    };
    if (useStore.persist.hasHydrated()) start();
    else return useStore.persist.onFinishHydration(start);
  }, []);

  // Catch up when the app comes back into view; realtime can drop while the phone sleeps.
  useEffect(() => onResume(() => useStore.getState().refresh()), []);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme: NavTheme = {
    ...base,
    colors: { ...base.colors, background: t.bg, card: t.surface, text: t.ink, border: t.line, primary: t.coral, notification: t.coral },
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.coral} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme} linking={Platform.OS === 'web' ? linking : undefined} documentTitle={{ formatter: () => 'BabyNames' }}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        {!session ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : justCreated ? (
          <Stack.Screen name="ShareCode" component={ShareCodeScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Deck" component={DeckScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Couch" component={CouchScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="Name" component={NameScreen} />
            <Stack.Screen name="AddName" component={AddNameScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="MyAnswers" component={MyAnswersScreen} />
            <Stack.Screen name="ThisOrThat" component={ThisOrThatScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
