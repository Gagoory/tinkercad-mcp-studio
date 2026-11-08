import type { ComponentSpec } from "./types.js";

export const COMPONENT_CATALOG: ComponentSpec[] = [
  {
    id: "arduino_uno_r3",
    did: 132521,
    search: "Arduino Uno R3",
    label: "Arduino Uno R3",
    aliases: ["arduino", "uno", "arduino uno", "아두이노", "아두이노 우노"],
    defaultPins: ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13", "A0", "A1", "A2", "A3", "A4", "A5", "5V", "3.3V", "GND", "VIN"]
  },
  {
    id: "led",
    did: 58422,
    search: "LED",
    label: "LED",
    aliases: ["light emitting diode", "발광 다이오드"],
    defaultPins: ["anode", "cathode"]
  },
  {
    id: "resistor",
    did: 53184,
    search: "Resistor",
    label: "Resistor",
    aliases: ["r", "저항", "레지스터"],
    defaultPins: ["pin1", "pin2"]
  },
  {
    id: "breadboard_small",
    did: 111211,
    search: "Breadboard Small",
    label: "Small breadboard",
    aliases: ["breadboard", "mini breadboard", "작은 브레드보드", "브레드보드", "빵판"],
    defaultPins: ["a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1", "i1", "j1", "pos", "neg"]
  },
  {
    id: "pushbutton",
    did: 144786,
    search: "Pushbutton",
    label: "Pushbutton",
    aliases: ["button", "switch", "누름 버튼", "버튼"],
    defaultPins: ["pin1", "pin2"]
  },
  {
    id: "potentiometer",
    did: 45547,
    search: "Potentiometer",
    label: "Potentiometer",
    aliases: ["pot", "trimmer", "가변저항", "포텐쇼미터"],
    defaultPins: ["wiper", "pin1", "pin2"]
  },
  {
    id: "photoresistor",
    did: 116691,
    search: "Photoresistor",
    label: "Photoresistor",
    aliases: ["ldr", "light sensor", "포토 레지스터", "조도 센서"],
    defaultPins: ["pin1", "pin2"]
  },
  {
    id: "capacitor",
    did: 57752,
    search: "Capacitor",
    label: "Capacitor",
    aliases: ["cap", "ceramic capacitor", "커패시터", "캐패시터", "축전기", "콘덴서"],
    defaultPins: ["pin1", "pin2"]
  },
  {
    id: "polarized_capacitor",
    did: 57950,
    search: "Polarized Capacitor",
    label: "Polarized Capacitor",
    aliases: ["electrolytic capacitor", "전해 커패시터", "편극 커패시터", "전해콘덴서"],
    defaultPins: ["positive", "negative"]
  },
  {
    id: "function_generator",
    did: 209278,
    search: "Function Generator",
    label: "Function Generator",
    aliases: ["funcgen", "fg", "signal generator", "함수 생성기", "함수 발생기", "함수발생기", "파형발생기"],
    defaultPins: ["positive", "negative"]
  },
  {
    id: "oscilloscope",
    did: 58630,
    search: "Oscilloscope",
    label: "Oscilloscope",
    aliases: ["scope", "osc", "오실로스코프", "스코프"],
    defaultPins: ["positive", "negative"]
  },
  {
    id: "power_supply",
    did: 111724,
    search: "Power Supply",
    label: "Power Supply",
    aliases: ["power", "ps", "dc power supply", "전원 공급 장치", "파워서플라이", "파워 서플라이"],
    defaultPins: ["positive", "negative"]
  },
  {
    id: "multimeter",
    did: 116662,
    search: "Multimeter",
    label: "Multimeter",
    aliases: ["meter", "dmm", "멀티미터", "전압계", "전류계"],
    defaultPins: ["positive", "negative"]
  },
  {
    id: "inductor",
    did: 58208,
    search: "Inductor",
    label: "Inductor",
    aliases: ["coil", "인덕터", "코일"],
    defaultPins: ["pin1", "pin2"]
  },
  {
    id: "diode",
    did: 58320,
    search: "Diode",
    label: "Diode",
    aliases: ["rectifier", "다이오드"],
    defaultPins: ["anode", "cathode"]
  },
  {
    id: "battery_9v",
    did: 116841,
    search: "9V Battery",
    label: "9V battery",
    aliases: ["battery", "9v", "9V 배터리", "배터리"],
    defaultPins: ["positive", "negative"]
  },
  {
    id: "piezo",
    did: 114067,
    search: "Piezo",
    label: "Piezo buzzer",
    aliases: ["buzzer", "speaker", "피에조", "부저"],
    defaultPins: ["pin1", "pin2"]
  },
  {
    id: "servo",
    did: 142073,
    search: "Micro Servo",
    label: "Micro servo",
    aliases: ["servo motor", "마이크로 서보", "서보 모터"],
    defaultPins: ["signal", "vcc", "gnd"]
  },
  {
    id: "ultrasonic",
    did: 219295,
    search: "Ultrasonic Distance Sensor",
    label: "Ultrasonic distance sensor",
    aliases: ["hc-sr04", "sonar", "초음파 거리 센서", "초음파 센서"],
    defaultPins: ["vcc", "trig", "echo", "gnd"]
  },
  {
    id: "lcd_16x2",
    did: 113878,
    search: "LCD 16 x 2",
    label: "LCD 16x2",
    aliases: ["lcd", "display", "LCD 16 x 2"],
    defaultPins: ["vss", "vdd", "vo", "rs", "rw", "e", "d4", "d5", "d6", "d7"]
  },
  {
    id: "slide_switch",
    did: 58458,
    search: "Slide Switch",
    label: "Slide switch",
    aliases: ["toggle", "슬라이드 스위치", "스위치"],
    defaultPins: ["pin1", "common", "pin2"]
  }
];

export function resolveComponent(query: string): ComponentSpec | undefined {
  const needle = query.trim().toLowerCase();
  const exact = COMPONENT_CATALOG.find((item) => {
    return (
      item.id === needle ||
      String(item.did) === needle ||
      item.search.toLowerCase() === needle ||
      item.label.toLowerCase() === needle ||
      item.aliases.some((alias) => alias.toLowerCase() === needle)
    );
  });
  if (exact) {
    return exact;
  }
  return COMPONENT_CATALOG.find((item) => {
    return (
      item.search.toLowerCase().includes(needle) ||
      item.label.toLowerCase().includes(needle) ||
      item.id.includes(needle) ||
      item.aliases.some((alias) => alias.toLowerCase().includes(needle))
    );
  });
}

export function listCatalogMatches(query?: string): ComponentSpec[] {
  if (!query || query.trim() === "") {
    return COMPONENT_CATALOG;
  }
  const needle = query.trim().toLowerCase();
  return COMPONENT_CATALOG.filter((item) => {
    return (
      item.id.includes(needle) ||
      String(item.did ?? "").includes(needle) ||
      item.search.toLowerCase().includes(needle) ||
      item.label.toLowerCase().includes(needle) ||
      item.aliases.some((alias) => alias.toLowerCase().includes(needle))
    );
  });
}
