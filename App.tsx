import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, TextInput } from "react-native";
import Orientation from "react-native-orientation-locker";
import SplashScreen from "./components/SplashScreen";
import TutorialScreen from "./components/TutorialScreen";
import Home from "./components/Home";
import ResultScreen from "./components/ResultScreen";
import EditResultScreen from "./components/EditResultScreen";
import IndicatorSetupScreen from "./components/IndicatorSetupScreen";

(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.allowFontScaling = false;

(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.allowFontScaling = false;

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    Orientation.lockToLandscape();

    return () => {
      Orientation.unlockAllOrientations();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: "#17120F",
            },
          }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Tutorial" component={TutorialScreen} />
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Result" component={ResultScreen} />
          <Stack.Screen name="EditResult" component={EditResultScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}