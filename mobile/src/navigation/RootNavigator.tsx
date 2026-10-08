import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutGrid,
  Users,
  CalendarClock,
  SlidersHorizontal,
  User as UserIcon,
} from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MyLeadsScreen } from '../screens/MyLeadsScreen';
import { FollowUpsScreen } from '../screens/FollowUpsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TeamScreen } from '../screens/TeamScreen';
import { CampaignsScreen } from '../screens/CampaignsScreen';
import { UploadLeadsScreen } from '../screens/UploadLeadsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RetryRulesScreen } from '../screens/RetryRulesScreen';
import { LeadDetailScreen } from '../screens/LeadDetailScreen';
import { DisposeScreen } from '../screens/DisposeScreen';
import { AddWalkInLeadScreen } from '../screens/AddWalkInLeadScreen';
import { CallHistoryScreen } from '../screens/CallHistoryScreen';
import { RootStackParamList } from '../types';
import { notificationService } from '../services/notification.service';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

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
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#94A3B8',
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
          tabBarIcon: ({ color, focused }) => (
            <LayoutGrid size={21} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tab.Screen
        name="MyLeads"
        component={MyLeadsScreen}
        options={{
          tabBarLabel: 'Leads',
          tabBarIcon: ({ color, focused }) => (
            <Users size={21} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tab.Screen
        name="FollowUps"
        component={FollowUpsScreen}
        options={{
          tabBarLabel: 'Follow-ups',
          tabBarIcon: ({ color, focused }) => (
            <CalendarClock size={21} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />

      {isManagerOrAdmin ? (
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Manage',
            tabBarIcon: ({ color, focused }) => (
              <SlidersHorizontal size={21} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
      ) : null}

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <UserIcon size={21} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
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
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="MyLeads" component={MyLeadsScreen} />
            <Stack.Screen name="FollowUps" component={FollowUpsScreen} />
            <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
            <Stack.Screen name="Team" component={TeamScreen} />
            <Stack.Screen name="Campaigns" component={CampaignsScreen} />
            <Stack.Screen name="UploadLeads" component={UploadLeadsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="RetryRules" component={RetryRulesScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
            <Stack.Screen name="Dispose" component={DisposeScreen} />
            <Stack.Screen name="AddWalkInLead" component={AddWalkInLeadScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
