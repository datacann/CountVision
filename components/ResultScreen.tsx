import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Orientation from "react-native-orientation-locker";
import AdBanner from "../components/AdBanner";
import { SafeAreaView } from "react-native-safe-area-context";

const mockTiles = [
  { number: "9", color: "yellow", x: 100, y: 100 },
  { number: "10", color: "yellow", x: 180, y: 100 },
  { number: "11", color: "yellow", x: 260, y: 100 },
  { number: "13", color: "red", x: 420, y: 100 },
  { number: "13", color: "black", x: 500, y: 100 },
  { number: "13", color: "other", x: 580, y: 100 },
  { number: "5", color: "red", x: 100, y: 220 },
];

const COLORS = ["yellow", "red", "black", "other"];

function getColorValue(color: string) {
  switch (color) {
    case "red":
      return "#B82A2A";
    case "black":
      return "#171717";
    case "yellow":
      return "#D47A1F";
    case "other":
      return "#1A9B56";
    default:
      return "#666";
  }
}

function splitRows(tiles: any[]) {
  if (!tiles.length) return [[], []];

  const sorted = [...tiles].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
  const avgY =
    sorted.reduce((sum, tile) => sum + (tile.y ?? 0), 0) / sorted.length;

  const top = sorted
    .filter((tile) => (tile.y ?? 0) <= avgY)
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));

  const bottom = sorted
    .filter((tile) => (tile.y ?? 0) > avgY)
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));

  return [top, bottom];
}

export default function EditResultScreen({ navigation, route }: any) {
  const { width } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      Orientation.lockToPortrait();
      return () => {};
    }, [])
  );

  const incomingTiles =
    route?.params?.result?.tiles ??
    route?.params?.result?.all_tiles ??
    mockTiles;

  const [tiles, setTiles] = useState(
    incomingTiles.map((tile: any, index: number) => ({
      ...tile,
      id: tile.id ?? `${index}-${tile.number}-${tile.color}`,
    }))
  );

  const [selectedId, setSelectedId] = useState(tiles[0]?.id ?? null);

  const selectedTile = tiles.find((tile: any) => tile.id === selectedId);

  const [topRow, bottomRow] = useMemo(() => splitRows(tiles), [tiles]);

  const maxRowCount = Math.max(topRow.length, bottomRow.length, 1);
  const availableRackWidth = width - 72;
  const tileGap = 4;
  const tileSize = Math.min(
    34,
    Math.max(22, (availableRackWidth - (maxRowCount - 1) * tileGap) / maxRowCount)
  );

  const updateSelectedTile = (patch: any) => {
    if (!selectedId) return;

    setTiles((prev: any[]) =>
      prev.map((tile) =>
        tile.id === selectedId ? { ...tile, ...patch } : tile
      )
    );
  };

  const changeNumber = (direction: "up" | "down") => {
    if (!selectedTile) return;

    let current = parseInt(selectedTile.number);
    if (Number.isNaN(current)) current = 1;

    current = direction === "up" ? current + 1 : current - 1;

    if (current > 13) current = 1;
    if (current < 1) current = 13;

    updateSelectedTile({ number: current.toString() });
  };

  const changeColor = (color: string) => {
    updateSelectedTile({ color });
  };

  const removeSelected = () => {
    if (!selectedId) return;

    const remaining = tiles.filter((tile: any) => tile.id !== selectedId);
    setTiles(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  };

  const addTile = () => {
    const newTile = {
      id: `new-${Date.now()}`,
      number: "1",
      color: "yellow",
      x: 9999,
      y: 9999,
    };

    setTiles((prev: any[]) => [...prev, newTile]);
    setSelectedId(newTile.id);
  };

  const saveChanges = () => {
    navigation.navigate("Result", {
      result: {
        tiles,
        all_tiles: tiles,
        total_sum: 0,
        valid_groups: [],
      },
    });
  };

  const renderTile = (tile: any) => {
    const selected = tile.id === selectedId;

    return (
      <TouchableOpacity
        key={tile.id}
        style={[
          styles.tile,
          {
            width: tileSize,
            height: tileSize * 1.45,
            borderRadius: Math.max(6, tileSize * 0.22),
          },
          selected && styles.selectedTile,
        ]}
        onPress={() => setSelectedId(tile.id)}
      >
        <Text
          style={[
            styles.tileNumber,
            {
              color: getColorValue(tile.color),
              fontSize: tileSize * 0.38
            },
          ]}
        >
          {tile.number}
        </Text>

        <View
          style={[
            styles.colorDot,
            {
              backgroundColor: getColorValue(tile.color),
              width: Math.max(5, tileSize * 0.18),
              height: Math.max(5, tileSize * 0.18),
              borderRadius: 999,
            },
          ]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Istakayi Duzenle</Text>

        <Text style={styles.subtitle}>
          Yanlis okunan tasi sec, sayisini veya rengini degistir.
        </Text>

        <View style={styles.rack}>
          <View style={[styles.row, { gap: tileGap }]}>
            {topRow.map(renderTile)}
          </View>

          <View style={styles.separator} />

          <View style={[styles.row, { gap: tileGap }]}>
            {bottomRow.map(renderTile)}
          </View>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={addTile}>
          <Text style={styles.addButtonText}>+ Yeni Tas Ekle</Text>
        </TouchableOpacity>

        <View style={styles.editorPanel}>
          <Text style={styles.panelTitle}>Secili Tas</Text>

          {selectedTile ? (
            <>
              <View style={styles.selectedPreview}>
                <View style={styles.bigTile}>
                  <Text
                    style={[
                      styles.bigTileNumber,
                      { color: getColorValue(selectedTile.color) },
                    ]}
                  >
                    {selectedTile.number}
                  </Text>

                  <View
                    style={[
                      styles.bigColorDot,
                      { backgroundColor: getColorValue(selectedTile.color) },
                    ]}
                  />
                </View>

                <View style={styles.numberControls}>
                  <TouchableOpacity
                    style={styles.numberButton}
                    onPress={() => changeNumber("down")}
                  >
                    <Text style={styles.numberButtonText}>−</Text>
                  </TouchableOpacity>

                  <Text style={styles.currentNumber}>{selectedTile.number}</Text>

                  <TouchableOpacity
                    style={styles.numberButton}
                    onPress={() => changeNumber("up")}
                  >
                    <Text style={styles.numberButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.controlLabel}>Renk</Text>

              <View style={styles.colorRow}>
                {COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      selectedTile.color === color && styles.selectedColor,
                    ]}
                    onPress={() => changeColor(color)}
                  >
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: getColorValue(color) },
                      ]}
                    />
                    <Text style={styles.colorText}>{color}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={removeSelected}
              >
                <Text style={styles.deleteButtonText}>Secili Tasi Sil</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.emptyText}>Duzenlenecek tas yok.</Text>
          )}
        </View>

        <View style={styles.scrollButtonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryText}>Iptal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={saveChanges}>
            <Text style={styles.primaryText}>Kaydet</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#17120F",
  },
  content: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 115,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    color: "#C9B7A7",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  rack: {
    marginTop: 20,
    backgroundColor: "#8B5A2B",
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#5A3618",
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  separator: {
    height: 7,
    backgroundColor: "#5A3618",
    borderRadius: 10,
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
    minHeight: 48,
  },
  tile: {
    backgroundColor: "#F1E3B6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#D1BE89",
  },
  selectedTile: {
    borderColor: "#00FF88",
    transform: [{ translateY: -3 }],
  },
  tileNumber: {
    fontWeight: "900",
  },
  colorDot: {
    marginTop: 1,
  },
  addButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(0,255,136,0.12)",
    borderWidth: 1,
    borderColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#00FF88",
    fontSize: 14,
    fontWeight: "900",
  },
  editorPanel: {
    marginTop: 18,
    backgroundColor: "#241B17",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.14)",
  },
  panelTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 16,
  },
  selectedPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
  },
  bigTile: {
    width: 82,
    height: 108,
    borderRadius: 16,
    backgroundColor: "#F1E3B6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1BE89",
  },
  bigTileNumber: {
    fontSize: 38,
    fontWeight: "900",
  },
  bigColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 8,
  },
  numberControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  numberButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  numberButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  currentNumber: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    minWidth: 34,
    textAlign: "center",
  },
  controlLabel: {
    marginTop: 20,
    marginBottom: 10,
    color: "#C9B7A7",
    fontSize: 14,
    fontWeight: "800",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  colorOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectedColor: {
    borderColor: "#00FF88",
  },
  colorCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  deleteButton: {
    marginTop: 18,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#FF7676",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyText: {
    color: "#C9B7A7",
    fontWeight: "700",
  },
  scrollButtonRow: {
    marginTop: 22,
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#07130D",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});