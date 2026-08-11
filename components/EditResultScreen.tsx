import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Orientation from "react-native-orientation-locker";
import { SafeAreaView } from "react-native-safe-area-context";
import { showAdEveryFiveEditAction } from "./InterstitialAdHelper";
import AdBanner from "./AdBanner";

const COLORS = ["yellow", "red", "black", "other"];
const GAP_THRESHOLD = 45;

type Tile = any;
type TileGroup = {
  id: string;
  row: 0 | 1;
  tiles: Tile[];
};

function normalizeColor(color?: string) {
  const c = color?.toLowerCase();
  if (c === "green") return "other";
  return c;
}

function getColorValue(color?: string) {
  switch (normalizeColor(color)) {
    case "red":
      return "#C73333";
    case "black":
      return "#171717";
    case "yellow":
      return "#D8841C";
    case "other":
      return "#1FA45A";
    default:
      return "#1FA45A";
  }
}

function getColorLabel(color?: string) {
  switch (normalizeColor(color)) {
    case "yellow":
      return "Sarı";
    case "red":
      return "Kırmızı";
    case "black":
      return "Siyah";
    case "other":
      return "Yeşil";
    default:
      return "Yeşil";
  }
}

function isOkeyTile(tile: Tile) {
  return tile?.is_okey || tile?.is_joker || tile?.number === "okey";
}

function isFakeOkeyTile(tile: Tile) {
  return tile?.is_fake_okey || tile?.number === "unknown";
}

function makeTileId(tile: Tile, index: number) {
  return tile.id ?? `${index}-${tile.number}-${tile.color}-${tile.x}-${tile.y}`;
}

function splitRows(tiles: Tile[]) {
  if (!tiles.length) return [[], []] as [Tile[], Tile[]];

  const sortedByY = [...tiles].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
  const heights = tiles.map((t) => t.h ?? 80);
  const avgHeight = heights.reduce((s, h) => s + h, 0) / heights.length;
  const rowThreshold = Math.max(45, Math.min(120, avgHeight * 0.8));

  const rows: Tile[][] = [];

  sortedByY.forEach((tile) => {
    let placed = false;

    for (const row of rows) {
      const avgY = row.reduce((s, t) => s + (t.y ?? 0), 0) / row.length;
      if (Math.abs((tile.y ?? 0) - avgY) <= rowThreshold) {
        row.push(tile);
        placed = true;
        break;
      }
    }

    if (!placed) rows.push([tile]);
  });

  const sortedRows = rows
    .map((row) => row.sort((a, b) => (a.x ?? 0) - (b.x ?? 0)))
    .sort((a, b) => {
      const ay = a.reduce((s, t) => s + (t.y ?? 0), 0) / a.length;
      const by = b.reduce((s, t) => s + (t.y ?? 0), 0) / b.length;
      return ay - by;
    });

  const top = sortedRows[0] ?? [];
  const bottom = sortedRows
    .slice(1)
    .flat()
    .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));

  return [top, bottom] as [Tile[], Tile[]];
}

function splitByGap(row: Tile[]) {
  const groups: Tile[][] = [];
  let current: Tile[] = [];

  row.forEach((tile) => {
    if (!current.length) {
      current.push(tile);
      return;
    }

    const prev = current[current.length - 1];
    const prevW = prev.w ?? 55;
    const tileW = tile.w ?? 55;

    const prevRight = (prev.x ?? 0) + prevW / 2;
    const tileLeft = (tile.x ?? 0) - tileW / 2;
    const realGap = tileLeft - prevRight;

    if (realGap > GAP_THRESHOLD) {
      groups.push(current);
      current = [tile];
    } else {
      current.push(tile);
    }
  });

  if (current.length) groups.push(current);
  return groups;
}

function createInitialGroups(incomingTiles: Tile[]): TileGroup[] {
  const normalizedTiles = incomingTiles.map((tile, index) => ({
    ...tile,
    id: makeTileId(tile, index),
    color: normalizeColor(tile.color),
  }));

  const [top, bottom] = splitRows(normalizedTiles);
  const topGroups = splitByGap(top);
  const bottomGroups = splitByGap(bottom);

  const result: TileGroup[] = [];

  topGroups.forEach((tiles, index) => {
    result.push({ id: `top-${index}-${Date.now()}`, row: 0, tiles });
  });

  bottomGroups.forEach((tiles, index) => {
    result.push({ id: `bottom-${index}-${Date.now()}`, row: 1, tiles });
  });

  return result;
}

function analyzeGroup(
  group: Tile[],
  okeyNumber?: string | number | null,
  okeyColor?: string | null,
) {
  if (group.length < 3) {
    return { type: "group", valid: false, sum: 0, tiles: group };
  }

  const selectedNumber = okeyNumber == null ? null : Number(okeyNumber);
  const selectedColor = normalizeColor(okeyColor ?? undefined);

  const isWildcard = (tile: Tile) => {
    if (isFakeOkeyTile(tile)) return false;

    if (isOkeyTile(tile)) return true;

    if (selectedNumber != null && selectedColor) {
      return (
        Number(tile?.number) === selectedNumber &&
        normalizeColor(tile?.color) === selectedColor
      );
    }

    return false;
  };

  // Sahte okey joker değildir. Okey seçildiyse o sayı/renkte normal taş gibi davranır.
  const getNormalValue = (tile: Tile) => {
    if (isFakeOkeyTile(tile) && selectedNumber != null && selectedColor) {
      return { number: selectedNumber, color: selectedColor };
    }

    return {
      number: Number(tile?.number),
      color: normalizeColor(tile?.color),
    };
  };

  const jokerCount = group.filter(isWildcard).length;
  const normalEntries = group
    .filter((tile) => !isWildcard(tile))
    .map(getNormalValue);

  if (jokerCount > 2 || normalEntries.length === 0) {
    return { type: "group", valid: false, sum: 0, tiles: group };
  }

  if (normalEntries.some((entry) => !Number.isInteger(entry.number) || entry.number < 1 || entry.number > 13 || !entry.color)) {
    return { type: "group", valid: false, sum: 0, tiles: group };
  }

  // PER: 3 veya 4 taş, aynı sayı, normal taşların renkleri birbirinden farklı.
  if (group.length <= 4) {
    const targetNumber = normalEntries[0].number;
    const normalColors = normalEntries.map((entry) => entry.color);
    const sameNumber = normalEntries.every((entry) => entry.number === targetNumber);
    const colorsUnique = new Set(normalColors).size === normalColors.length;
    const availableColorSlots = 4 - normalColors.length;

    if (sameNumber && colorsUnique && jokerCount <= availableColorSlots) {
      return {
        type: "per",
        valid: true,
        sum: targetNumber * group.length,
        tiles: group,
      };
    }
  }

  // SERİ: Ekrandaki sıra korunur. Okey bulunduğu pozisyondaki eksik sayıyı tamamlar.
  if (group.length <= 13) {
    const normalColors = normalEntries.map((entry) => entry.color);
    const sameColor = new Set(normalColors).size === 1;

    if (sameColor) {
      for (let startNumber = 1; startNumber <= 14 - group.length; startNumber++) {
        let valid = true;

        for (let index = 0; index < group.length; index++) {
          const tile = group[index];
          if (isWildcard(tile)) continue;

          const value = getNormalValue(tile);
          const expectedNumber = startNumber + index;

          if (value.number !== expectedNumber || value.color !== normalColors[0]) {
            valid = false;
            break;
          }
        }

        if (valid) {
          const completedNumbers = Array.from(
            { length: group.length },
            (_, index) => startNumber + index,
          );

          return {
            type: "seri",
            valid: true,
            sum: completedNumbers.reduce((sum, number) => sum + number, 0),
            tiles: group,
            completedNumbers,
          };
        }
      }
    }
  }

  return { type: "group", valid: false, sum: 0, tiles: group };
}

function getGroupLabel(group: Tile[], okeyNumber?: string | number | null, okeyColor?: string | null) {
  const analyzed = analyzeGroup(group, okeyNumber, okeyColor);
  if (analyzed.type === "per") return `PER • ${analyzed.sum}`;
  if (analyzed.type === "seri") return `SERİ • ${analyzed.sum}`;
  return "GRUP";
}

type DraggableTileProps = {
  tileId: string;
  children: React.ReactNode;
  onTap: () => void;
  onDragSelect: () => void;
  onDrop: (tileId: string, moveX: number, moveY: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

function DraggableTile({
  tileId,
  children,
  onTap,
  onDragSelect,
  onDrop,
  onDragStateChange,
}: DraggableTileProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const lift = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragActiveRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const activateDrag = useCallback(() => {
    if (dragActiveRef.current) return;

    dragActiveRef.current = true;
    setDragging(true);
    onDragSelect();
    onDragStateChange(true);

    Animated.spring(lift, {
      toValue: 1,
      useNativeDriver: false,
      friction: 6,
      tension: 120,
    }).start();
  }, [lift, onDragSelect, onDragStateChange]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const finishDrag = useCallback(
    (shouldDrop: boolean, moveX = 0, moveY = 0) => {
      clearHoldTimer();

      if (!dragActiveRef.current) {
        onTap();
        return;
      }

      if (shouldDrop) {
        onDrop(tileId, moveX, moveY);
      }

      Animated.parallel([
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          friction: 8,
          tension: 70,
        }),
        Animated.timing(lift, {
          toValue: 0,
          duration: 180,
          useNativeDriver: false,
        }),
      ]).start(() => {
        dragActiveRef.current = false;
        setDragging(false);
        onDragStateChange(false);
      });
    },
    [clearHoldTimer, lift, onDragStateChange, onDrop, onTap, pan, tileId],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          clearHoldTimer();
          holdTimer.current = setTimeout(activateDrag, 180);
        },
        onPanResponderMove: (_, gestureState) => {
          if (!dragActiveRef.current) return;
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderRelease: (_, gestureState) => {
          finishDrag(true, gestureState.moveX, gestureState.moveY);
        },
        onPanResponderTerminate: () => {
          finishDrag(false);
        },
        onPanResponderTerminationRequest: () => !dragActiveRef.current,
      }),
    [activateDrag, clearHoldTimer, finishDrag, pan],
  );

  const animatedStyle = {
    transform: [
      ...pan.getTranslateTransform(),
      {
        translateY: lift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        }),
      },
      {
        scale: lift.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.1],
        }),
      },
      {
        rotateZ: lift.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "-2deg"],
        }),
      },
    ],
    zIndex: dragging ? 1000 : 1,
    elevation: lift.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 18],
    }),
    opacity: lift.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.96],
    }),
    shadowOpacity: lift.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.35],
    }),
    shadowRadius: lift.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 8],
    }),
    shadowOffset: { width: 0, height: 5 },
  };

  return (
    <Animated.View {...panResponder.panHandlers} style={animatedStyle}>
      {children}
    </Animated.View>
  );
}

export default function EditResultScreen({ navigation, route }: any) {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const scale = Math.min(1, shortSide / 390);

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const result = route?.params?.result ?? {};
  const incomingTiles = result?.all_tiles ?? result?.tiles ?? [];

  const initialOkeyNumber = result?.okeyNumber ?? null;
  const initialOkeyColor = normalizeColor(result?.okeyColor);

  const [groups, setGroups] = useState<TileGroup[]>(() =>
    createInitialGroups(incomingTiles),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    groups[0]?.tiles[0]?.id ?? null,
  );
  const [isDraggingTile, setIsDraggingTile] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [okeyPickerVisible, setOkeyPickerVisible] = useState(false);
  const [okeyNumber, setOkeyNumber] = useState<string | null>(
    initialOkeyNumber == null ? null : String(initialOkeyNumber),
  );
  const [okeyColor, setOkeyColor] = useState<string | null>(
    initialOkeyColor ?? null,
  );
  const groupRefs = useRef<Record<string, View | null>>({});

  const openOkeyPicker = useCallback(() => {
    // Popup'ta varsayılan olarak görünen değerler state'e de yazılsın.
    // Böylece kullanıcı sarı/1'i tekrar seçmeden Kaydet butonu aktif olur.
    setOkeyNumber((current) => current ?? "1");
    setOkeyColor((current) => current ?? "yellow");
    setOkeyPickerVisible(true);
  }, []);

  useEffect(() => {
    if (!okeyNumber || !okeyColor) return;

    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tiles: group.tiles.map((tile) =>
          isFakeOkeyTile(tile)
            ? {
                ...tile,
                number: String(okeyNumber),
                color: okeyColor,
                is_fake_okey: true,
                is_okey: false,
                is_joker: false,
              }
            : tile,
        ),
      })),
    );
  }, [okeyNumber, okeyColor]);

  const goToHome = useCallback(() => {
    navigation.replace("Home");
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      Orientation.lockToLandscape();

      const t1 = setTimeout(() => Orientation.lockToLandscape(), 50);
      const t2 = setTimeout(() => Orientation.lockToLandscape(), 250);

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          goToHome();
          return true;
        },
      );

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        backHandler.remove();
      };
    }, [goToHome]),
  );

  const allTiles = useMemo(
    () => groups.flatMap((group) => group.tiles),
    [groups],
  );
  const selectedTile = allTiles.find((tile) => tile.id === selectedId);

  const openEditor = useCallback((tileId: string) => {
    setSelectedId(tileId);
    setEditorVisible(true);
  }, []);

  const validGroups = useMemo(
    () =>
      groups.map((group) => analyzeGroup(group.tiles, okeyNumber, okeyColor)).filter((g) => g.valid),
    [groups, okeyNumber, okeyColor],
  );
  const totalSum = validGroups.reduce(
    (sum: number, group: any) => sum + group.sum,
    0,
  );
  const mainPoint = Math.floor(totalSum / 3);
  const sidePoint = totalSum % 3;
  const groupedSummary =
    totalSum > 0
      ? sidePoint > 0
        ? `${mainPoint} yan ${sidePoint}`
        : `${mainPoint}`
      : "Geçerli per/seri yok";

  const maxRowCount = Math.max(
    groups
      .filter((g) => g.row === 0)
      .reduce((sum, g) => sum + g.tiles.length, 0),
    groups
      .filter((g) => g.row === 1)
      .reduce((sum, g) => sum + g.tiles.length, 0),
    1,
  );

  const rackAvailableWidth = width - 92;
  const tileGap = 5;
  const tileWidth = Math.min(
    44,
    Math.max(25, (rackAvailableWidth - maxRowCount * tileGap) / maxRowCount),
  );

  const moveTileToGroup = useCallback(
    (tileId: string, targetGroupId: string, insertionIndex: number) => {
      LayoutAnimation.configureNext({
        duration: 240,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });

      setGroups((prev) => {
        let movingTile: Tile | null = null;

        const withoutTile = prev.map((group) => {
          const found = group.tiles.find((tile) => tile.id === tileId);
          if (found) movingTile = found;

          return {
            ...group,
            tiles: group.tiles.filter((tile) => tile.id !== tileId),
          };
        });

        if (!movingTile) return prev;

        const targetIndex = withoutTile.findIndex(
          (group) => group.id === targetGroupId,
        );
        if (targetIndex < 0) return prev;

        const targetGroup = withoutTile[targetIndex];
        const safeIndex = Math.max(
          0,
          Math.min(insertionIndex, targetGroup.tiles.length),
        );
        const nextTargetTiles = [...targetGroup.tiles];
        nextTargetTiles.splice(safeIndex, 0, movingTile);

        return withoutTile
          .map((group, index) =>
            index === targetIndex
              ? { ...group, tiles: nextTargetTiles }
              : group,
          )
          .filter((group) => group.tiles.length > 0);
      });

      setSelectedId(tileId);
      void showAdEveryFiveEditAction();
    },
    [],
  );

  const handleTileDrop = useCallback(
    (tileId: string, moveX: number, moveY: number) => {
      const measurableGroups = Object.entries(groupRefs.current).filter(
        ([, ref]) => Boolean(ref),
      );

      if (!measurableGroups.length) return;

      const measurements = measurableGroups.map(
        ([groupId, ref]) =>
          new Promise<{
            groupId: string;
            x: number;
            y: number;
            width: number;
            height: number;
          } | null>((resolve) => {
            ref?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
              resolve({
                groupId,
                x,
                y,
                width: measuredWidth,
                height: measuredHeight,
              });
            });
          }),
      );

      Promise.all(measurements).then((rectangles) => {
        const validRectangles = rectangles.filter(
          (rect): rect is NonNullable<typeof rect> => Boolean(rect),
        );

        if (!validRectangles.length) return;

        const DROP_MARGIN = 24;

        const containing = validRectangles.find(
          (rect) =>
            moveX >= rect.x - DROP_MARGIN &&
            moveX <= rect.x + rect.width + DROP_MARGIN &&
            moveY >= rect.y - DROP_MARGIN &&
            moveY <= rect.y + rect.height + DROP_MARGIN,
        );

        const target =
          containing ??
          validRectangles.reduce(
            (nearest, rect) => {
              const centerX = rect.x + rect.width / 2;
              const centerY = rect.y + rect.height / 2;
              const distance = Math.hypot(moveX - centerX, moveY - centerY);

              if (!nearest || distance < nearest.distance) {
                return { rect, distance };
              }

              return nearest;
            },
            null as {
              rect: (typeof validRectangles)[number];
              distance: number;
            } | null,
          )?.rect;

        if (!target) return;

        const targetGroup = groups.find((group) => group.id === target.groupId);
        if (!targetGroup) return;

        const relativeX = moveX - target.x;
        const estimatedTileSlot = tileWidth + 3;
        const insertionIndex = Math.round(relativeX / estimatedTileSlot);

        moveTileToGroup(tileId, target.groupId, insertionIndex);
      });
    },
    [groups, moveTileToGroup, tileWidth],
  );

  const topGroups = groups.filter((group) => group.row === 0);
  const bottomGroups = groups.filter((group) => group.row === 1);

  const updateSelected = async (patch: any) => {
    if (!selectedId) return;
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        tiles: group.tiles.map((tile) =>
          tile.id === selectedId ? { ...tile, ...patch } : tile,
        ),
      })),
    );
    await showAdEveryFiveEditAction();
  };

  const changeNumber = (direction: "up" | "down") => {
    if (!selectedTile) return;
    let current = parseInt(selectedTile.number);
    if (Number.isNaN(current)) current = 1;
    current = direction === "up" ? current + 1 : current - 1;
    if (current > 13) current = 1;
    if (current < 1) current = 13;

    updateSelected({
      number: current.toString(),
      is_okey: false,
      is_joker: false,
      is_fake_okey: false,
    });
  };

  const changeColor = (color: string) => {
    updateSelected({
      color,
      is_okey: false,
      is_joker: false,
      is_fake_okey: false,
    });
  };

  const makeSelectedOkey = () => {
    if (!selectedTile) return;

    updateSelected({
      number: "okey",
      color: null,
      is_okey: true,
      is_joker: true,
      is_fake_okey: false,
    });
  };

  const makeSelectedFakeOkey = () => {
    if (!selectedTile || !okeyNumber || !okeyColor) return;

    updateSelected({
      number: String(okeyNumber),
      color: okeyColor,
      is_fake_okey: true,
      is_okey: false,
      is_joker: false,
    });
  };

  const makeSelectedNormal = () => {
    if (!selectedTile) return;
    updateSelected({
      number: /^\d+$/.test(String(selectedTile.number)) ? String(selectedTile.number) : "1",
      color: normalizeColor(selectedTile.color) || "yellow",
      is_fake_okey: false,
      is_okey: false,
      is_joker: false,
    });
  };

  const separateFromSelected = async () => {
    if (!selectedId) return;

    setGroups((prev) => {
      const groupIndex = prev.findIndex((group) =>
        group.tiles.some((tile) => tile.id === selectedId),
      );
      if (groupIndex < 0) return prev;

      const targetGroup = prev[groupIndex];
      const tileIndex = targetGroup.tiles.findIndex(
        (tile) => tile.id === selectedId,
      );
      if (tileIndex <= 0) return prev;

      const leftTiles = targetGroup.tiles.slice(0, tileIndex);
      const rightTiles = targetGroup.tiles.slice(tileIndex);

      const newGroups = [...prev];
      newGroups.splice(
        groupIndex,
        1,
        { ...targetGroup, tiles: leftTiles },
        {
          id: `${targetGroup.id}-split-${Date.now()}`,
          row: targetGroup.row,
          tiles: rightTiles,
        },
      );

      return newGroups;
    });

    await showAdEveryFiveEditAction();
  };

  const mergeSelectedToLeft = async () => {
    if (!selectedId) return;

    setGroups((prev) => {
      const groupIndex = prev.findIndex((group) =>
        group.tiles.some((tile) => tile.id === selectedId),
      );
      if (groupIndex <= 0) return prev;

      const targetGroup = prev[groupIndex];

      let leftGroupIndex = -1;
      for (let i = groupIndex - 1; i >= 0; i--) {
        if (prev[i].row === targetGroup.row) {
          leftGroupIndex = i;
          break;
        }
      }

      if (leftGroupIndex < 0) return prev;

      const leftGroup = prev[leftGroupIndex];
      const mergedGroup = {
        ...leftGroup,
        tiles: [...leftGroup.tiles, ...targetGroup.tiles],
      };

      return prev
        .filter((_, index) => index !== groupIndex)
        .map((group, index) =>
          index === leftGroupIndex ? mergedGroup : group,
        );
    });

    await showAdEveryFiveEditAction();
  };

  const removeTile = async () => {
    if (!selectedId) return;

    setGroups((prev) => {
      const newGroups = prev
        .map((group) => ({
          ...group,
          tiles: group.tiles.filter((tile) => tile.id !== selectedId),
        }))
        .filter((group) => group.tiles.length > 0);

      const nextSelected = newGroups[0]?.tiles[0]?.id ?? null;
      setSelectedId(nextSelected);
      return newGroups;
    });

    setEditorVisible(false);
    await showAdEveryFiveEditAction();
  };

  const addTile = async () => {
    const newTile = {
      id: `new-${Date.now()}`,
      number: "1",
      color: "yellow",
      is_okey: false,
      is_joker: false,
      is_fake_okey: false,
      w: 55,
      h: 80,
    };

    setGroups((prev) => [
      ...prev,
      {
        id: `added-group-${Date.now()}`,
        row: 1,
        tiles: [newTile],
      },
    ]);

    setSelectedId(newTile.id);
    setEditorVisible(true);
    await showAdEveryFiveEditAction();
  };

  const renderTile = (tile: Tile) => {
    const selected = tile.id === selectedId;
    const fakeOkeyTile = isFakeOkeyTile(tile);
    const literalOkeyTile = String(tile.number ?? "").trim().toLowerCase() === "okey";
    const okeyTile = Boolean(
      literalOkeyTile ||
      (!fakeOkeyTile &&
        (okeyNumber && okeyColor
          ? String(tile.number) === String(okeyNumber) &&
            normalizeColor(tile.color) === normalizeColor(okeyColor)
          : isOkeyTile(tile))),
    );

    return (
      <DraggableTile
        key={tile.id}
        tileId={tile.id}
        onTap={() => openEditor(tile.id)}
        onDragSelect={() => setSelectedId(tile.id)}
        onDrop={handleTileDrop}
        onDragStateChange={setIsDraggingTile}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          style={[
            styles.tile,
            {
              width: tileWidth,
              height: tileWidth * 1.42,
              borderRadius: tileWidth * 0.22,
            },
            selected && styles.selectedTile,
            fakeOkeyTile && styles.fakeOkeyTile,
          ]}
          onPress={() => openEditor(tile.id)}
        >
          {fakeOkeyTile ? (
            <Text
              allowFontScaling={false}
              style={[
                styles.tileNumber,
                { color: "#6B3F1D", fontSize: Math.max(16, tileWidth * 0.52) },
              ]}
            >
              ★
            </Text>
          ) : okeyTile ? null : (
            <>
              <Text
                allowFontScaling={false}
                style={[
                  styles.tileNumber,
                  {
                    color: getColorValue(tile.color),
                    fontSize: Math.max(14, tileWidth * 0.48),
                  },
                ]}
              >
                {tile.number}
              </Text>
              <View
                style={[
                  styles.tileDot,
                  {
                    backgroundColor: getColorValue(tile.color),
                    width: Math.max(6, tileWidth * 0.16),
                    height: Math.max(6, tileWidth * 0.16),
                  },
                ]}
              />
            </>
          )}
        </TouchableOpacity>
      </DraggableTile>
    );
  };

  const renderGroup = (group: TileGroup) => {
    const label = getGroupLabel(group.tiles, okeyNumber, okeyColor);
    const isPer = label.startsWith("PER");
    const isSeri = label.startsWith("SERİ");

    return (
      <View
        key={group.id}
        ref={(node) => {
          groupRefs.current[group.id] = node;
        }}
        collapsable={false}
        style={[
          styles.groupBlock,
          isPer && styles.validPerGroup,
          isSeri && styles.validSeriGroup,
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[
            styles.groupLabel,
            isPer && styles.perLabel,
            isSeri && styles.seriLabel,
          ]}
        >
          {label}
        </Text>
        <View style={styles.groupTiles}>{group.tiles.map(renderTile)}</View>
      </View>
    );
  };

  const selectedIsOkey = Boolean(
    selectedTile &&
      (String(selectedTile.number ?? "").trim().toLowerCase() === "okey" ||
        (!isFakeOkeyTile(selectedTile) &&
          (okeyNumber && okeyColor
            ? String(selectedTile.number) === String(okeyNumber) &&
              normalizeColor(selectedTile.color) === normalizeColor(okeyColor)
            : isOkeyTile(selectedTile)))),
  );
  const selectedIsFakeOkey = selectedTile && isFakeOkeyTile(selectedTile);

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        scrollEnabled={!isDraggingTile}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { padding: 16 * scale, paddingBottom: 20 * scale },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.headerBackButton}
              onPress={goToHome}
              accessibilityRole="button"
              accessibilityLabel="Geri dön"
            >
              <Text allowFontScaling={false} style={styles.headerBackIcon}>‹</Text>
            </TouchableOpacity>

            <View>
              <Text
                allowFontScaling={false}
                style={[styles.title, { fontSize: 24 * scale }]}
              >
                Istakayı Düzenle
              </Text>
              <Text allowFontScaling={false} style={styles.subtitle}>
                Yanlış taşı seçip düzelt, grupları kontrol et.
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.okeyInfoBox, (!okeyNumber || !okeyColor) && styles.okeyInfoBoxEmpty]}
              activeOpacity={0.75}
              onPress={openOkeyPicker}
            >
              <View style={styles.okeyInfoTopRow}>
                <Text allowFontScaling={false} style={styles.okeyInfoLabel}>Okey</Text>
                <Text allowFontScaling={false} style={styles.okeyInfoAction}>
                  {okeyNumber && okeyColor ? "Değiştir ›" : "Seç ›"}
                </Text>
              </View>

              {okeyNumber && okeyColor ? (
                <View style={styles.okeyInfoRow}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.okeyInfoNumber, { color: getColorValue(okeyColor) }]}
                  >
                    {okeyNumber}
                  </Text>
                  <View style={[styles.okeyInfoDot, { backgroundColor: getColorValue(okeyColor) }]} />
                </View>
              ) : (
                <Text allowFontScaling={false} style={styles.okeyInfoPrompt}>
                  Hesaplama için seç
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.scoreBox}>
              <Text allowFontScaling={false} style={styles.scoreLabel}>
                Toplam
              </Text>
              <Text allowFontScaling={false} style={styles.scoreValue}>
                {totalSum}
              </Text>
              <Text allowFontScaling={false} style={styles.scoreBreakdown}>
                {groupedSummary}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rack}>
          <View style={styles.rackRow}>{topGroups.map(renderGroup)}</View>
          <View style={styles.separator} />
          <View style={styles.rackRow}>{bottomGroups.map(renderGroup)}</View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.addButton}
          onPress={addTile}
        >
          <Text allowFontScaling={false} style={styles.addButtonText}>
            + Yeni Taş Ekle
          </Text>
        </TouchableOpacity>
        <Text allowFontScaling={false} style={styles.dragHint}>
          Taşa kısa süre basılı tut; taş kalkınca sürükleyip istediğin yere
          bırak.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={goToHome}
          >
            <Text allowFontScaling={false} style={styles.cancelText}>
              Geri
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={["landscape", "landscape-left", "landscape-right"]}
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: Math.min(width - 52, 700) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text allowFontScaling={false} style={styles.modalTitle}>
                  Taşı Düzenle
                </Text>
                <Text allowFontScaling={false} style={styles.modalSubtitle}>
                  Sayı, renk veya taş türünü değiştir.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditorVisible(false)}
              >
                <Text allowFontScaling={false} style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {selectedTile ? (
              <View style={styles.modalBody}>
                <View style={styles.modalPreviewColumn}>
                  <View style={[styles.bigTile, selectedIsFakeOkey && styles.bigFakeOkeyTile]}>
                    {selectedIsFakeOkey ? (
                      <>
                        <Text allowFontScaling={false} style={[styles.bigTileNumber, { color: "#6B3F1D" }]}>★</Text>
                        <Text allowFontScaling={false} style={styles.bigTileCaption}>SAHTE OKEY</Text>
                      </>
                    ) : selectedIsOkey ? null : (
                      <>
                        <Text allowFontScaling={false} style={[styles.bigTileNumber, { color: getColorValue(selectedTile.color) }]}>
                          {selectedTile.number}
                        </Text>
                        <View style={[styles.bigDot, { backgroundColor: getColorValue(selectedTile.color) }]} />
                      </>
                    )}
                  </View>
                </View>

                <View style={styles.modalControls}>
                  <View style={styles.numberControls}>
                    <TouchableOpacity style={styles.numberButton} onPress={() => changeNumber("down")}>
                      <Text allowFontScaling={false} style={styles.numberButtonText}>−</Text>
                    </TouchableOpacity>
                    <View style={styles.currentInfo}>
                      <Text allowFontScaling={false} style={styles.currentNumber}>
                        {selectedIsFakeOkey ? `★ = ${okeyNumber}` : selectedIsOkey ? "" : selectedTile.number}
                      </Text>
                      <Text allowFontScaling={false} style={styles.currentColor}>
                        {selectedIsFakeOkey ? `${getColorLabel(okeyColor ?? undefined)} ${okeyNumber}` : selectedIsOkey ? "" : getColorLabel(selectedTile.color)}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.numberButton} onPress={() => changeNumber("up")}>
                      <Text allowFontScaling={false} style={styles.numberButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <Text allowFontScaling={false} style={styles.controlLabel}>Renk</Text>
                  <View style={styles.colorRow}>
                    {COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorButton,
                          normalizeColor(selectedTile.color) === color &&
                            !selectedIsOkey &&
                            !selectedIsFakeOkey &&
                            styles.selectedColorButton,
                        ]}
                        onPress={() => changeColor(color)}
                      >
                        <View style={[styles.colorCircle, { backgroundColor: getColorValue(color) }]} />
                        <Text allowFontScaling={false} style={styles.colorText}>{getColorLabel(color)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.specialActions}>
                    <TouchableOpacity
                      style={styles.okeyButton}
                      onPress={selectedIsOkey ? makeSelectedNormal : makeSelectedOkey}
                    >
                      <Text allowFontScaling={false} style={styles.okeyText}>
                        {selectedIsOkey ? "Normal Taşa Çevir" : "Okey Yap"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.fakeOkeyButton, (!okeyNumber || !okeyColor) && { opacity: 0.45 }]}
                      onPress={selectedIsFakeOkey ? makeSelectedNormal : makeSelectedFakeOkey}
                      disabled={!okeyNumber || !okeyColor}
                    >
                      <Text allowFontScaling={false} style={styles.fakeOkeyText}>
                        {selectedIsFakeOkey ? "Normal Taşa Çevir" : "Sahte Okey Yap"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.deleteButton} onPress={removeTile}>
                      <Text allowFontScaling={false} style={styles.deleteText}>Sil</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <Text allowFontScaling={false} style={styles.emptyText}>Düzenlenecek taş yok.</Text>
            )}

            <TouchableOpacity style={styles.doneButton} onPress={() => setEditorVisible(false)}>
              <Text allowFontScaling={false} style={styles.doneButtonText}>Bitti</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={okeyPickerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={["landscape", "landscape-left", "landscape-right"]}
        onRequestClose={() => setOkeyPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.okeyPickerCard, { maxWidth: Math.min(width - 92, 560) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text allowFontScaling={false} style={styles.modalTitle}>Okeyi Seç</Text>
                <Text allowFontScaling={false} style={styles.modalSubtitle}>
                  Bu sayı ve renkteki normal taşlar joker sayılır. Sahte okey yalnızca bu taşın değeriyle hesaplanır.
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setOkeyPickerVisible(false)}>
                <Text allowFontScaling={false} style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.okeyPickerBody}>
              <View style={styles.okeyPreviewColumn}>
                <Text allowFontScaling={false} style={styles.controlLabel}>Seçilen okey</Text>
                <View style={styles.okeyPreviewTile}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.okeyPreviewNumber, { color: getColorValue(okeyColor ?? "yellow") }]}
                  >
                    {okeyNumber ?? "?"}
                  </Text>
                  <View
                    style={[styles.okeyPreviewDot, { backgroundColor: getColorValue(okeyColor ?? "yellow") }]}
                  />
                </View>
                <Text allowFontScaling={false} style={styles.okeyPreviewHint}>
                  Sahte okey de {okeyNumber && okeyColor ? `${getColorLabel(okeyColor)} ${okeyNumber}` : "bu değer"} olarak hesaplanır.
                </Text>
              </View>

              <View style={styles.okeyPickerControls}>
                <Text allowFontScaling={false} style={styles.controlLabel}>Sayı</Text>
                <View style={styles.numberWheel}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    contentContainerStyle={styles.numberWheelContent}
                  >
                    {Array.from({ length: 13 }, (_, index) => String(index + 1)).map((number) => (
                      <TouchableOpacity
                        key={number}
                        style={[styles.numberWheelItem, okeyNumber === number && styles.numberWheelItemSelected]}
                        onPress={() => setOkeyNumber(number)}
                      >
                        <Text
                          allowFontScaling={false}
                          style={[styles.numberWheelText, okeyNumber === number && styles.numberWheelTextSelected]}
                        >
                          {number}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <Text allowFontScaling={false} style={styles.controlLabel}>Renk</Text>
                <View style={styles.colorRow}>
                  {COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.colorButton, okeyColor === color && styles.selectedColorButton]}
                      onPress={() => setOkeyColor(color)}
                    >
                      <View style={[styles.colorCircle, { backgroundColor: getColorValue(color) }]} />
                      <Text allowFontScaling={false} style={styles.colorText}>{getColorLabel(color)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.doneButton, styles.okeyPickerDoneButton, (!okeyNumber || !okeyColor) && { opacity: 0.45 }]}
              disabled={!okeyNumber || !okeyColor}
              onPress={() => setOkeyPickerVisible(false)}
            >
              <Text allowFontScaling={false} style={styles.doneButtonText}>Okeyi Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#17120F" },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexShrink: 1,
    gap: 9,
  },
  headerBackButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  headerBackIcon: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "500",
    lineHeight: 35,
    marginTop: -2,
  },
  title: { color: "#FFFFFF", fontWeight: "900" },
  subtitle: {
    marginTop: 4,
    color: "#C9B7A7",
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 520,
  },
  headerRight: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  okeyInfoBox: {
    minWidth: 142,
    backgroundColor: "rgba(245,215,161,0.13)",
    borderWidth: 2,
    borderColor: "rgba(245,215,161,0.58)",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  okeyInfoBoxEmpty: {
    borderColor: "#00FF88",
    backgroundColor: "rgba(0,255,136,0.10)",
  },
  okeyInfoTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  okeyInfoLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  okeyInfoAction: { color: "#00FF88", fontSize: 11, fontWeight: "900" },
  okeyInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  okeyInfoNumber: { fontSize: 22, fontWeight: "900" },
  okeyInfoDot: { width: 9, height: 9, borderRadius: 5 },
  okeyInfoEmpty: { color: "#C9B7A7", fontSize: 20, fontWeight: "900", marginTop: 2 },
  okeyInfoPrompt: { color: "#DDFBEA", fontSize: 11, fontWeight: "800", marginTop: 7 },
  scoreBox: {
    minWidth: 116,
    backgroundColor: "rgba(0,255,136,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.35)",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  scoreLabel: { color: "#C9B7A7", fontSize: 11, fontWeight: "800" },
  scoreValue: { color: "#00FF88", fontSize: 25, fontWeight: "900" },
  scoreBreakdown: {
    marginTop: 2,
    color: "#C9B7A7",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  rack: {
    backgroundColor: "#9A6330",
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#5A3618",
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  rackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 92,
  },
  separator: {
    height: 8,
    backgroundColor: "#5A3618",
    borderRadius: 999,
    marginVertical: 8,
  },
  groupBlock: {
    alignItems: "center",
    marginHorizontal: 3,
    paddingHorizontal: 3,
    paddingTop: 4,
    paddingBottom: 5,
    borderRadius: 13,
  },
  validPerGroup: { backgroundColor: "rgba(0,255,136,0.08)" },
  validSeriGroup: { backgroundColor: "rgba(245,215,161,0.08)" },
  groupLabel: {
    color: "#F5D7A1",
    fontSize: 9,
    fontWeight: "900",
    marginBottom: 5,
    letterSpacing: 0.6,
  },
  perLabel: { color: "#00FF88" },
  seriLabel: { color: "#F5D7A1" },
  groupTiles: {
    flexDirection: "row",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.10)",
    padding: 3,
    borderRadius: 10,
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
    borderWidth: 3,
    transform: [{ translateY: -3 }],
  },

  okeyTile: {
    borderColor: "#F5D7A1",
    borderWidth: 2,
    backgroundColor: "#FFF1C7",
  },
  fakeOkeyTile: {
    borderColor: "#D8841C",
    borderWidth: 2,
    backgroundColor: "#F6E4B8",
  },
  okeyBadge: {
    position: "absolute",
    top: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "#6B3F1D",
    zIndex: 2,
  },
  okeyBadgeText: { color: "#FFF4D6", fontSize: 5.5, fontWeight: "900" },
  tileNumber: { fontWeight: "900" },
  tileDot: { borderRadius: 999, marginTop: 2 },
  addButton: {
    marginTop: 12,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(0,255,136,0.12)",
    borderWidth: 1,
    borderColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: { color: "#00FF88", fontSize: 14, fontWeight: "900" },
  dragHint: {
    marginTop: 7,
    color: "#9F8D80",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#241B17",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.24)",
    paddingHorizontal: 13,
    paddingVertical: 3,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  modalSubtitle: { color: "#C9B7A7", fontSize: 10, fontWeight: "700", marginTop: 1 },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: { color: "#FFFFFF", fontSize: 27, fontWeight: "500", lineHeight: 29 },
  modalBody: { flexDirection: "row", alignItems: "center", gap: 16 },
  modalPreviewColumn: { width: 92, alignItems: "center", justifyContent: "center" },
  modalControls: { flex: 1 },
  specialActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  doneButton: {
    marginTop: 5,
    height: 36,
    borderRadius: 15,
    backgroundColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: { color: "#07130D", fontSize: 14, fontWeight: "900" },
  editorPanel: {
    marginTop: 12,
    backgroundColor: "#241B17",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.14)",
  },
  panelTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  editorContent: { flexDirection: "row", alignItems: "center", gap: 18 },
  bigTile: {
    width: 70,
    height: 94,
    borderRadius: 14,
    backgroundColor: "#F1E3B6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1BE89",
  },
  bigTileNumber: { fontSize: 33, fontWeight: "900" },
  bigDot: { width: 12, height: 12, borderRadius: 6, marginTop: 7 },
  bigOkeyTile: { borderWidth: 2, borderColor: "#F5D7A1", backgroundColor: "#FFF1C7" },
  bigFakeOkeyTile: { borderWidth: 2, borderColor: "#D8841C", backgroundColor: "#F6E4B8" },
  bigOkeyBadge: { position: "absolute", top: 7, color: "#6B3F1D", fontSize: 9, fontWeight: "900" },
  bigTileCaption: { position: "absolute", bottom: 7, color: "#6B3F1D", fontSize: 8, fontWeight: "900" },
  controlsArea: { flex: 1 },
  numberControls: { flexDirection: "row", alignItems: "center", gap: 10 },
  numberButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  numberButtonText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  currentInfo: { minWidth: 74, alignItems: "center" },
  currentNumber: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  currentColor: {
    color: "#C9B7A7",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  controlLabel: {
    marginTop: 10,
    marginBottom: 8,
    color: "#C9B7A7",
    fontSize: 13,
    fontWeight: "900",
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  colorButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectedColorButton: {
    borderColor: "#00FF88",
    backgroundColor: "rgba(0,255,136,0.10)",
  },
  colorCircle: { width: 10, height: 10, borderRadius: 5 },
  colorText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  groupActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    maxWidth: 270,
  },
  splitButton: {
    width: 126,
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(245,215,161,0.13)",
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  splitText: { color: "#F5D7A1", fontSize: 13, fontWeight: "900" },
  mergeButton: {
    width: 126,
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,255,136,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  mergeText: { color: "#00FF88", fontSize: 13, fontWeight: "900" },
  deleteButton: {
    width: 126,
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#FF7676", fontSize: 13, fontWeight: "900" },
  okeyButton: {
    width: 126,
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(245,215,161,0.13)",
    borderWidth: 1,
    borderColor: "rgba(245,215,161,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  okeyText: { color: "#F5D7A1", fontSize: 13, fontWeight: "900" },
  fakeOkeyButton: {
    width: 126,
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(216,132,28,0.14)",
    borderWidth: 1,
    borderColor: "rgba(216,132,28,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  fakeOkeyText: { color: "#F5D7A1", fontSize: 13, fontWeight: "900" },
  emptyText: { color: "#C9B7A7", fontWeight: "700" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#00FF88",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  saveText: { color: "#07130D", fontWeight: "900", fontSize: 14 },
okeyPickerCard: {
  width: "82%",
  backgroundColor: "#241B17",
  borderRadius: 20,
  paddingHorizontal: 13,
  paddingVertical: 4,
  borderWidth: 1,
  borderColor: "rgba(245,215,161,0.22)",
},
  okeyPickerBody: { flexDirection: "row", gap: 14, alignItems: "center" },
  okeyPickerDoneButton: { marginTop: 8, height: 40 },
  okeyPreviewColumn: { width: 155, alignItems: "center" },
  okeyPreviewTile: {
    width: 74,
    height: 102,
    borderRadius: 16,
    backgroundColor: "#FFF1C7",
    borderWidth: 2,
    borderColor: "#F5D7A1",
    alignItems: "center",
    justifyContent: "center",
  },
  okeyPreviewNumber: { fontSize: 36, fontWeight: "900" },
  okeyPreviewDot: { width: 13, height: 13, borderRadius: 7, marginTop: 7 },
  okeyPreviewBadge: { position: "absolute", top: 8, color: "#6B3F1D", fontSize: 9, fontWeight: "900" },
  okeyPreviewHint: { marginTop: 9, color: "#C9B7A7", fontSize: 10, lineHeight: 14, fontWeight: "700", textAlign: "center" },
  okeyPickerControls: { flex: 1 },
  numberWheel: {
    width: 86,
    height: 100,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  numberWheelContent: { paddingVertical: 5 },
  numberWheelItem: { height: 38, alignItems: "center", justifyContent: "center", marginHorizontal: 5, borderRadius: 10 },
  numberWheelItemSelected: { backgroundColor: "rgba(0,255,136,0.16)", borderWidth: 1, borderColor: "#00FF88" },
  numberWheelText: { color: "#C9B7A7", fontSize: 16, fontWeight: "800" },
  numberWheelTextSelected: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
});
