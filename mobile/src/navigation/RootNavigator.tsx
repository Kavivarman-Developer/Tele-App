import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuthStore } from '../store/authStore';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MyLeadsScreen } from '../screens/MyLeadsScreen';
import { FollowUpsScreen } from '../screens/FollowUpsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

import { RootStackParamList } from '../types';
import { LeadDetailScreen } from '../screens/LeadDetailScreen';
import { DisposeScreen } from '../screens/DisposeScreen';
import { AddWalkInLeadScreen } from '../screens/AddWalkInLeadScreen';
import { notificationService } from '../services/notification.service';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const TabBarIcon = ({ icon, focused }: { icon: string; focused: boolean }) => (
  <Text style={{ fontSize: focused ? 20 : 18 }}>{icon}</Text>
);

const MainTabs: React.FC = () => {
  const { user } = useAuthStore();
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
          elevation: 6,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MyLeads"
        component={MyLeadsScreen}
        options={{
          tabBarLabel: 'My Leads',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="📋" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="FollowUps"
        component={FollowUpsScreen}
        options={{
          tabBarLabel: 'Follow-ups',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="⏰" focused={focused} />,
        }}
      />

      {/* Conditionally visible tab: Only for ADMIN and MANAGER */}
      {isManagerOrAdmin ? (
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ focused }) => <TabBarIcon icon="📊" focused={focused} />,
          }}
        />
      ) : null}

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const { token, isLoading, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
    notificationService.requestPermissions();
  }, [restoreSession]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
            <Stack.Screen name="Dispose" component={DisposeScreen} />
            <Stack.Screen name="AddWalkInLead" component={AddWalkInLeadScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
