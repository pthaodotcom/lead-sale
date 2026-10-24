export const cities = ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng"];
export const offices = [
  "văn phòng HN1",
  "văn phòng HN2",
  "văn phòng HCM1",
  "văn phòng HCM2",
  "văn phòng ĐN1",
  "văn phòng ĐN2",
];
export const normalizeCity = (value: string) =>
  ({
    HN: "Hà Nội",
    HCM: "Hồ Chí Minh",
    "TP.HCM": "Hồ Chí Minh",
    ĐN: "Đà Nẵng",
  })[value as "HN"] ?? value;
