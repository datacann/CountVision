import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Header() {
    return (
        <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
            <Text>101 Hesaplama</Text>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container : {
        backgroundColor: "#a87658",
    }
}
    
)