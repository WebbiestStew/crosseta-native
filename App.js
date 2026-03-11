import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { AppProvider, useApp } from './context/AppContext';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import DetailScreen from './screens/DetailScreen';
import AlertsScreen from './screens/AlertsScreen';
import CommunityScreen from './screens/CommunityScreen';
import TripsScreen from './screens/TripsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReportScreen from './screens/ReportScreen';
import ShareScreen from './screens/ShareScreen';
import InLineScreen from './screens/InLineScreen';
import TripHistoryScreen from './screens/TripHistoryScreen';
import CrossingComparisonScreen from './screens/CrossingComparisonScreen';
import TripPlanningScreen from './screens/TripPlanningScreen';
import ChecklistScreen from './screens/ChecklistScreen';
import MapScreen from './screens/MapScreen';
import { TrackingFAB } from './components/TrackingFAB';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const TripsStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// Stable ref used for notification deep-linking outside NavigationContainer
export const navigationRef = createNavigationContainerRef();

function TabIcon({ emoji, label, focused, dark }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  );
}

function HomeTabs({ navigation }) {
  const { dark, crossings, favorites, notifSettings, thresholds } = useApp();

  // Count starred crossings currently above their threshold (for Alerts badge)
  const alertBadgeCount = crossings.filter((c) =>
    favorites.includes(c.id) &&
    notifSettings[c.id] &&
    c.wait > (thresholds[c.id] ?? 20)
  ).length;

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: dark ? '#1C1C1E' : '#fff',
            borderTopColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            borderTopWidth: 0.5,
            paddingBottom: 4,
            height: 82,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
        })}
      >
        <Tab.Screen
          name="CrossingsTab"
          options={{ title: 'Crossings', tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} dark={dark} /> }}
        >
          {(props) => <HomeStackNavigator {...props} />}
        </Tab.Screen>
        <Tab.Screen
          name="AlertsTab"
          component={AlertsScreen}
          options={{
            title: 'Alerts',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} dark={dark} />,
            tabBarBadge: alertBadgeCount > 0 ? alertBadgeCount : undefined,
            tabBarBadgeStyle: { backgroundColor: '#FF453A', color: '#fff', fontSize: 10, fontWeight: '700' },
          }}
        />
        <Tab.Screen
          name="CommunityTab"
          component={CommunityScreen}
          options={{ title: 'Community', tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} dark={dark} /> }}
        />
        <Tab.Screen
          name="TripsTab"
          options={{ title: 'My Trips', tabBarIcon: ({ focused }) => <TabIcon emoji="🚗" focused={focused} dark={dark} /> }}
        >
          {(props) => <TripsStackNavigator {...props} />}
        </Tab.Screen>
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{ title: 'Settings', tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} dark={dark} /> }}
        />
      </Tab.Navigator>
      {/* Global FAB — floats above all tabs */}
      <TrackingFAB navigation={navigation} dark={dark} />
    </View>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Detail" component={DetailScreen} />
      <HomeStack.Screen name="Compare" component={CrossingComparisonScreen} />
      <HomeStack.Screen name="Map" component={MapScreen} />
    </HomeStack.Navigator>
  );
}

function TripsStackNavigator() {
  return (
    <TripsStack.Navigator screenOptions={{ headerShown: false }}>
      <TripsStack.Screen name="Trips" component={TripsScreen} />
      <TripsStack.Screen name="TripHistory" component={TripHistoryScreen} />
    </TripsStack.Navigator>
  );
}

/* Stale-data banner — shown when CBP data hasn't refreshed in 15+ min */
function StaleBanner() {
  const translateY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  }, []);

  return (
    <Animated.View style={[styles.staleBanner, { transform: [{ translateY }] }]}>
      <Text style={styles.staleBannerText}>⚠️ Live data may be delayed — tap a crossing to refresh</Text>
    </Animated.View>
  );
}

/* Notification banner */
function NotificationBanner({ message, onHide }) {
  const translateY = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
      Animated.delay(3000),
      Animated.timing(translateY, { toValue: -80, duration: 300, useNativeDriver: true }),
    ]).start(onHide);
  }, []);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Text style={styles.bannerText}>{message}</Text>
    </Animated.View>
  );
}

function AppNavigator() {
  const { onboarded, dark, completeOnboarding, lastFetchTime, crossings } = useApp();
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    // If never fetched, flag as stale after 60s; if fetched, flag stale 15 min later
    setIsStale(false);
    const delay = lastFetchTime === null ? 60 * 1000 : 15 * 60 * 1000;
    const t = setTimeout(() => setIsStale(true), delay);
    return () => clearTimeout(t);
  }, [lastFetchTime]);

  // ─── Notification deep-linking ───────────────────────────────────────
  // When user taps a notification, navigate to the relevant crossing Detail.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const { crossingId } = response.notification.request.content.data ?? {};
      if (!crossingId || !navigationRef.isReady()) return;
      const crossing = crossings.find((c) => c.id === crossingId);
      if (!crossing) return;
      navigationRef.navigate('Detail', { crossing });
    });
    return () => sub.remove();
  }, [crossings]);

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {isStale && <StaleBanner />}
      <NavigationContainer ref={navigationRef} theme={dark ? DarkTheme : DefaultTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {!onboarded ? (
            <RootStack.Screen name="Onboarding">
              {(props) => <OnboardingScreen {...props} onComplete={completeOnboarding} />}
            </RootStack.Screen>
          ) : (
            <>
              <RootStack.Screen name="Main" component={HomeTabs} />
              <RootStack.Screen
                name="Report"
                component={ReportScreen}
                options={{ presentation: 'modal' }}
              />
              <RootStack.Screen
                name="Share"
                component={ShareScreen}
                options={{ presentation: 'modal' }}
              />
              <RootStack.Screen
                name="InLine"
                component={InLineScreen}
                options={{ presentation: 'modal', gestureEnabled: false }}
              />
              <RootStack.Screen
                name="TripPlan"
                component={TripPlanningScreen}
                options={{ presentation: 'modal' }}
              />
              <RootStack.Screen
                name="Checklist"
                component={ChecklistScreen}
                options={{ presentation: 'modal' }}
              />
            </>
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#007AFF',
    padding: 16,
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 10,
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  staleBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 998,
    backgroundColor: '#FF9F0A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 50,
  },
  staleBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
