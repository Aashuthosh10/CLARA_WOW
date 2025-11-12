export interface Location {
  key: string;
  name: string;
  floor: number;
  floor_name: string;
  description: string;
  steps: string[];
  citations: number[];
  keywords: string[];
  startingPoint: string;
  room_number: string | null;
  building: string;
  coordinates?: { x: number; y: number } | null;
}

export const BUILDING_NAME = 'Sai Vidya Institution of Technology';
export const STARTING_POINT =
  'Outside the Ground Floor main central entrance (approaching the corridor between the Gymnasium and UPS rooms).';

type FloorKey = 'groundFloor' | 'firstFloor' | 'secondFloor';

const FLOOR_META: Record<FloorKey, { level: number; label: string }> = {
  groundFloor: { level: 0, label: 'Ground Floor' },
  firstFloor: { level: 1, label: 'First Floor' },
  secondFloor: { level: 2, label: 'Second Floor' },
};

interface RawRoom {
  floor: FloorKey;
  name: string;
  directions: string;
}

const GROUND_FLOOR_ROOMS: RawRoom[] = [
  {
    floor: 'groundFloor',
    name: 'GYMNASIUM & YOGA',
    directions:
      "Approach and enter the main central entrance. The 'GYMNASIUM & YOGA' [cite: 139] is the first room on your immediate left.",
  },
  {
    floor: 'groundFloor',
    name: 'DEPT OF LAB',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]The 'DEPT OF LAB' [cite: 140] is the second room on the left.",
  },
  {
    floor: 'groundFloor',
    name: 'COMPUTER CENTER 01',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]The 'COMPUTER CENTER 01' [cite: 141] is the third room on the left.",
  },
  {
    floor: 'groundFloor',
    name: 'LIBRARY CENTER',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]Walk to the end of this corridor[cite: 146]. [cite_start]The 'LIBRARY CENTER' [cite: 142] is the last room on the left.",
  },
  {
    floor: 'groundFloor',
    name: 'UPS (East)',
    directions:
      "Approach and enter the main central entrance. [cite_start]The 'UPS' room [cite: 170] is the first room on your immediate right.",
  },
  {
    floor: 'groundFloor',
    name: 'Medical Room',
    directions:
      "Approach and enter the main central entrance. Turn right. [cite_start]The 'Medical Room' [cite: 171] is the second room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'East Staircase/Lift',
    directions:
      "Approach and enter the main central entrance. Turn right. [cite_start]Walk past the 'UPS' [cite: 170] [cite_start]and 'Medical Room'[cite: 171]. The staircase and lift lobby is on your right.",
  },
  {
    floor: 'groundFloor',
    name: 'AUDITORIUM',
    directions:
      "Approach and enter the main central entrance. Turn right. [cite_start]Walk past the 'Medical Room'[cite: 171]. [cite_start]The 'AUDITORIUM' [cite: 169] is the large room on your left.",
  },
  {
    floor: 'groundFloor',
    name: 'SWAMY VIVEKANAND SEMINAR HALL',
    directions:
      "Approach and enter the main central entrance. [cite_start]Turn right and walk past the 'AUDITORIUM'[cite: 169]. [cite_start]Turn right into the next corridor[cite: 174]. [cite_start]The 'SWAMY VIVEKANAND SEMINAR HALL' [cite: 175] is the large room on your left.",
  },
  {
    floor: 'groundFloor',
    name: 'GEOLOGY LAB',
    directions:
      "Approach and enter the main central entrance. [cite_start]Turn right, walk to the end of the top corridor (past the 'AUDITORIUM' [cite: 169]). Turn right. [cite_start]The 'GEOLOGY LAB' [cite: 178] is the first room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'SURVEY LAB',
    directions:
      "Approach and enter the main central entrance. Turn right, walk to the end of the top corridor. Turn right. [cite_start]The 'SURVEY LAB' [cite: 179] is the second room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'BMT LAB',
    directions:
      "Approach and enter the main central entrance. Turn right, walk to the end of the top corridor. Turn right. [cite_start]The 'BMT LAB' [cite: 180] is the last room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'West Staircase/Lift',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]Walk to the end of this corridor, past the 'LIBRARY CENTER'[cite: 142]. [cite_start]Turn left into the vertical corridor[cite: 149]. The staircase and lift lobby is on your right.",
  },
  {
    floor: 'groundFloor',
    name: 'DIRECTOR ROOM',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]The 'DIRECTOR ROOM' [cite: 137] is the first room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'PRINCIPAL CHAMBER',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]Walk past the 'DIRECTOR ROOM'[cite: 137]. [cite_start]The 'PRINCIPAL CHAMBER' [cite: 130] is the second room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'BOARD ROOM',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]Walk past the 'PRINCIPAL CHAMBER'[cite: 130]. [cite_start]The 'BOARD ROOM' [cite: 129] is the third room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'ADMIN ROOM',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]Walk past the 'BOARD ROOM'[cite: 129]. [cite_start]The 'ADMIN ROOM' [cite: 145] is the fourth room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'UPS (West)',
    directions:
      "Approach and enter the main central entrance. Turn left. [cite_start]Walk past the 'ADMIN ROOM'[cite: 145]. [cite_start]The 'UPS' room [cite: 167] is the fifth room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'TRAINING AND PLACEMENT CENTER',
    directions:
      "Approach and enter the main central entrance. Turn left, walk to the end of the top corridor, and turn left again. [cite_start]The 'TRAINING AND PLACEMENT CENTER' [cite: 132] is the first room on your left.",
  },
  {
    floor: 'groundFloor',
    name: 'ENTREPRENEURSHIP AND INCUBATION',
    directions:
      "Approach and enter the main central entrance. Turn left, walk to the end of the top corridor, and turn left. [cite_start]This center [cite: 147] is the second room on the left.",
  },
  {
    floor: 'groundFloor',
    name: 'Dept of Maths',
    directions:
      "Approach and enter the main central entrance. Turn left, walk to the end of the top corridor, and turn left. [cite_start]The 'Dept of Maths' [cite: 150] is the third room on the left.",
  },
  {
    floor: 'groundFloor',
    name: 'WASH ROOM (West)',
    directions:
      "Approach and enter the main central entrance. Turn left, walk to the end of the top corridor, and turn left. [cite_start]The 'WASH ROOM' [cite: 151] is the last room on the left, before the lift.",
  },
  {
    floor: 'groundFloor',
    name: 'Vice Principal',
    directions:
      "Go to the West Staircase (enter, turn left, walk to end, turn left). Walk down the long vertical corridor. [cite_start]The 'Vice Principal's' office [cite: 156] is the first room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'NOC ROOM',
    directions:
      "Go to the West Staircase. [cite_start]Walk down the vertical corridor past the 'Vice Principal's' office[cite: 156]. [cite_start]The 'NOC ROOM' [cite: 157] is the next room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'STORE ROOM',
    directions:
      "Go to the West Staircase. [cite_start]Walk down the vertical corridor past the 'NOC ROOM'[cite: 157]. [cite_start]The 'STORE ROOM' [cite: 158] is the next room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'SPORTS ROOM 003',
    directions:
      "Go to the West Staircase. Walk down the vertical corridor. [cite_start]The 'SPORTS ROOM' [cite: 164] [cite_start]is the large room on the right, past the 'STORE ROOM'[cite: 158].",
  },
  {
    floor: 'groundFloor',
    name: 'WASH ROOM (South)',
    directions:
      "Go to the West Staircase. [cite_start]Walk down the vertical corridor past the 'SPORTS ROOM'[cite: 164]. [cite_start]The 'WASH ROOM' [cite: 165] is the next room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'ROOM NO 001',
    directions:
      "Go to the West Staircase. Walk down the vertical corridor. [cite_start]'ROOM NO 001' [cite: 161] is the second to last room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'RAILWAY DEVELOPMENT',
    directions:
      "Go to the West Staircase. Walk down the vertical corridor. [cite_start]The 'RAILWAY DEVELOPMENT' room [cite: 195] is the last room on the right.",
  },
  {
    floor: 'groundFloor',
    name: 'LANGUAGE LAB',
    directions:
      "Go to the West Staircase. Walk down the vertical corridor. [cite_start]The 'LANGUAGE LAB' [cite: 162] is the last room on the left.",
  },
  {
    floor: 'groundFloor',
    name: 'ROOM NO 002',
    directions:
      "Go to the West Staircase. Walk down the vertical corridor. [cite_start]'ROOM NO 002' [cite: 160] is the second to last room on the left.",
  },
  {
    floor: 'groundFloor',
    name: 'Basic and High...',
    directions:
      "Go to the West Staircase. Walk down the vertical corridor. [cite_start]This room [cite: 159] is the third room on the left.",
  },
  {
    floor: 'groundFloor',
    name: 'HOD',
    directions:
      "Go to the West Staircase. Walk down the vertical corridor. [cite_start]The 'HOD' room [cite: 154] is the second room on the left.",
  },
];

const FIRST_FLOOR_ROOMS: RawRoom[] = [
  {
    floor: 'firstFloor',
    name: 'library',
    directions:
      "Approach and enter the main Ground Floor entrance. [cite_start]Turn right, walk past the UPS [cite: 170] rooms to the East Staircase. Take the stairs/lift to the First Floor. [cite_start]The 'library' [cite: 234] is immediately on your right.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 141',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase (on right). Go to the First Floor. [cite_start]Turn right and walk past the 'library'[cite: 234]. [cite_start]'ROOM NO 141' [cite: 268] is at the end of the corridor.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 140',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Turn right and walk past the 'library'[cite: 234]. [cite_start]'ROOM NO 140' [cite: 248] is the second to last room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 139',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Turn right and walk past the 'library'[cite: 234]. [cite_start]'ROOM NO 139' [cite: 247] is the third to last room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 138',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Turn right and walk past the 'library'[cite: 234]. [cite_start]'ROOM NO 138' [cite: 246] is the fourth to last room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 137',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Turn right and walk past the 'library'[cite: 234]. [cite_start]'ROOM NO 137' [cite: 245] is the fifth to last room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 136',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Turn right and walk past the 'library'[cite: 234]. [cite_start]'ROOM NO 136' [cite: 244] is the sixth to last room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 135 (East)',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Turn right and walk past the 'library'[cite: 234]. [cite_start]'ROOM NO 135' [cite: 242] is the seventh to last room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'Gents Rest Room',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Walk straight ahead into the 4.2 WIDE CORRIDOR[cite: 224]. [cite_start]The 'Gents Rest Room' [cite: 231] is on your left.",
  },
  {
    floor: 'firstFloor',
    name: 'Girls Rest Room',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Walk straight ahead. [cite_start]The 'Girls Rest Room' [cite: 227] is on your right.",
  },
  {
    floor: 'firstFloor',
    name: 'Dr.Vikram Sarabai Computer Lab 133',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Walk straight ahead. [cite_start]The lab [cite: 219] [cite_start]is the large room on your right, past the 'Girls Rest Room'[cite: 227].",
  },
  {
    floor: 'firstFloor',
    name: 'Dept CSE Faculty Room-2',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Walk straight ahead to the end of the 4.2 WIDE CORRIDOR[cite: 224]. [cite_start]This room [cite: 218] is on your right.",
  },
  {
    floor: 'firstFloor',
    name: 'CS Faculty Room',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. [cite_start]Walk straight ahead into the 4.2 WIDE CORRIDOR[cite: 224], then turn left. [cite_start]The 'CS Faculty Room' [cite: 239] is the first room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'CSE Dept Labrary-102',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Walk straight ahead, then turn left. [cite_start]The 'CSE Dept Labrary-102' [cite: 256] is the first room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'Dept of ISE Research...',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Walk straight ahead, then turn left. [cite_start]This room [cite: 260] is the second room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'CNR RAO',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase (on right). Go to the First Floor. [cite_start]Turn left into the 2.45 WIDE CORRIDOR[cite: 208]. [cite_start]The 'CNR RAO' room [cite: 217] is the first room on your left.",
  },
  {
    floor: 'firstFloor',
    name: 'Ratan tata',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Turn left. [cite_start]'Ratan tata' [cite: 216] is the second room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'Chanukya',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Turn left. [cite_start]'Chanukya' [cite: 215] is the third room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'Sudha Murthi',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Turn left. [cite_start]'Sudha Murthi' [cite: 214] is the fourth room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'AML Lab for Railways R&D',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Turn left. [cite_start]This 'AML Lab' [cite: 213] is the fifth room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'Gents Wash Room',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Turn left. [cite_start]The 'Gents Wash Room' [cite: 205] is the sixth room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'Cyber signal lab-2',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Turn left. [cite_start]The 'Cyber signal lab-2' [cite: 204] is the seventh room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'Platonic lab for railway RD',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Turn left. [cite_start]The 'Platonic lab' [cite: 203] is the eighth room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'Room no 123',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the First Floor. Turn left. Walk to the end of the corridor. [cite_start]'Room no 123' [cite: 202] is the last room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'West Staircase/Lift',
    directions:
      "Approach and enter the main Ground Floor entrance. Turn left, walk to the end of the top corridor, and turn left again. The West Staircase and lift lobby is on your right. Take the stairs/lift to the First Floor.",
  },
  {
    floor: 'firstFloor',
    name: 'Room no 122',
    directions:
      "Go to the West Staircase and go to the First Floor. [cite_start]'Room no 122' [cite: 209] is the first room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'IS Faculty',
    directions:
      "Go to the West Staircase and go to the First Floor. [cite_start]The 'IS Faculty' room [cite: 235] is the second room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'IS HOD Room',
    directions:
      "Go to the West Staircase and go to the First Floor. [cite_start]The 'IS HOD Room' [cite: 236] is the third room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'CS HOD Room',
    directions:
      "Go to the West Staircase and go to the First Floor. [cite_start]The 'CS HOD Room' [cite: 237] is the fourth room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'Girls wash Room (West)',
    directions:
      "Go to the West Staircase and go to the First Floor. [cite_start]The 'Girls wash Room' [cite: 249] is the last room on the left, before the lift.",
  },
  {
    floor: 'firstFloor',
    name: 'Dept of EC',
    directions:
      "Go to the West Staircase and go to the First Floor. [cite_start]The 'Dept of EC' office [cite: 251] is on the right, by the staircase.",
  },
  {
    floor: 'firstFloor',
    name: 'EC Faculty Room',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the long vertical corridor. [cite_start]The 'EC Faculty Room' [cite: 269] is the first room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'Room No 104',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]'Room No 104' [cite: 272] is the second room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'Room No 105',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]'Room No 105' [cite: 280] is the third room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'Room No 106',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]'Room No 106' [cite: 281] is the fourth room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'Room No 107',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]'Room No 107' [cite: 282] is the fifth room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'Girls Wash Room (South)',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]This 'Girls Wash Room' [cite: 283] is the sixth room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'SVIT Club',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]The 'SVIT Club' [cite: 284] is the seventh room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 108',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]'ROOM NO 108' [cite: 297] is the last room on the right.",
  },
  {
    floor: 'firstFloor',
    name: 'EPC LAB-1',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the long vertical corridor. [cite_start]The 'EPC LAB-1' [cite: 252] is the first room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'CN LAB',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]The 'CN LAB' [cite: 253] is the second room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'ROOM NO 135 (West)',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]'ROOM NO 135' [cite: 292] is the third room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'VLSI Libarary',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]The 'VLSI Libarary' [cite: 293] is the fourth room on the left.",
  },
  {
    floor: 'firstFloor',
    name: 'HOD',
    directions:
      "Go to the West Staircase. Go to the First Floor. Walk down the vertical corridor. [cite_start]The 'HOD' room [cite: 294] is the last room on the left.",
  },
];

const SECOND_FLOOR_ROOMS: RawRoom[] = [
  {
    floor: 'secondFloor',
    name: 'LIBRARY',
    directions:
      "Approach and enter the main Ground Floor entrance. [cite_start]Turn right, walk past the UPS [cite: 170] rooms to the East Staircase. Take the stairs/lift to the Second Floor. [cite_start]The 'LIBRARY' [cite: 63] is immediately on your right.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-240',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase (on right). Go to the Second Floor. [cite_start]Turn left into the 2.50 WIDE CORRIDOR[cite: 13]. [cite_start]'LH-240' [cite: 77] is the first room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-201',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]'LH-201' [cite: 75] is the second room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-202',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]'LH-202' [cite: 76] is the third room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-203',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]'LH-203' [cite: 96] is the fourth room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'Dept of Basic Science & Engineering Computer Lab',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]This lab [cite: 43] is the fifth room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'CIVIL MECHANICAL STAFF ROOM',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]This staff room [cite: 42] is the sixth room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'HOD CIVIL',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]The 'HOD CIVIL' office [cite: 41] is the seventh room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'HOD MECHANICAL',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]The 'HOD MECHANICAL' office [cite: 40] is the eighth room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'COMPUTER LAB',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]The 'COMPUTER LAB' [cite: 37] is the ninth room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'SEMINAR HALL',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]The 'SEMINAR HALL' [cite: 35] is the tenth room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'DEPT OF CHE (AIML) STAFF ROOM',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]This staff room [cite: 33] is the eleventh room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-236',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]'LH-236' [cite: 32] is the twelfth room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'Dept of... STAFF ROOM',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. [cite_start]This staff room [cite: 31] is the thirteenth room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'BOYS COMMON ROOM',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Turn left. Walk to the end of the corridor. [cite_start]The 'BOYS COMMON ROOM' [cite: 28] is the last room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-239',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase (on right). Go to the Second Floor. [cite_start]Walk straight ahead into the 2.50 WIDE CORRIDOR[cite: 68]. [cite_start]'LH-239' [cite: 73] is the first room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-238',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]'LH-238' [cite: 71] is the second room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-237',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]'LH-237' [cite: 69] is the third room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'CLASS ROOM (East-Central)',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]The 'CLASS ROOM' [cite: 45] is the first room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'CLASS ROOM (East-Central 2)',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]This 'CLASS ROOM' [cite: 47] is the second room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'DEPT OF INFORMATION SCIENCE...',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]This Dept [cite: 17] is the third room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'TOLET (North)',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]This 'TOLET' [cite: 24] is the fourth room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'CIVIL & MECHANICAL CAD LAB',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]This lab [cite: 23] is the fifth room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'TOLET (South)',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]This 'TOLET' [cite: 26] is the sixth room on the right.",
  },
  {
    floor: 'secondFloor',
    name: '(AIML) LAB',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]The '(AIML) LAB' [cite: 9] is the seventh room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'DEPT OF CSE (DS) LAB-1',
    directions:
      "Approach and enter the main Ground Floor entrance. Go to the East Staircase. Go to the Second Floor. Walk straight. [cite_start]This lab [cite: 11] is the last room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'West Staircase/Lift',
    directions:
      "Approach and enter the main Ground Floor entrance. Turn left, walk to the end of the top corridor, and turn left again. The West Staircase and lift lobby is on your right. Take the stairs/lift to the Second Floor.",
  },
  {
    floor: 'secondFloor',
    name: 'CLASS ROOM (West 1)',
    directions:
      "Go to the West Staircase and go to the Second Floor. [cite_start]This 'CLASS ROOM' [cite: 54] is the first room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'CLASS ROOM (West 2)',
    directions:
      "Go to the West Staircase and go to the Second Floor. [cite_start]This 'CLASS ROOM' [cite: 55] is the second room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'DS HOD ROOM',
    directions:
      "Go to the West Staircase and go to the Second Floor. [cite_start]The 'DS HOD ROOM' [cite: 51] is the third room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'CLASS ROOM (West 3)',
    directions:
      "Go to the West Staircase and go to the Second Floor. [cite_start]This 'CLASS ROOM' [cite: 59] is the last room on the left, before the lift.",
  },
  {
    floor: 'secondFloor',
    name: 'DEPT PF ECE FACULTY ROOM-2',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the long vertical corridor. [cite_start]This 'ECE Faculty Room' [cite: 53] is the first room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'CLASS ROOM (South-West)',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]This 'CLASS ROOM' [cite: 66] is the second room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-211',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]'LH-211' [cite: 60] is the third room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-210',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]'LH-210' [cite: 105] is the fourth room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-209',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]'LH-209' [cite: 107] is the fifth room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-208',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]'LH-208' [cite: 108] is the sixth room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'ECE DEPT LIBRARY',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]The 'ECE DEPT LIBRARY' [cite: 110] is the seventh room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-207',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]'LH-207' [cite: 113] is the last room on the right.",
  },
  {
    floor: 'secondFloor',
    name: 'LH-205',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]'LH-205' [cite: 116] is the last room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'STAFF ROOM',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]The 'STAFF ROOM' [cite: 117] is the second to last room on the left.",
  },
  {
    floor: 'secondFloor',
    name: 'CELL',
    directions:
      "Go to the West Staircase. Go to the Second Floor. Walk down the vertical corridor. [cite_start]The 'CELL' [cite: 114] is the third to last room on the left.",
  },
];

const RAW_ROOMS: RawRoom[] = [
  ...GROUND_FLOOR_ROOMS,
  ...FIRST_FLOOR_ROOMS,
  ...SECOND_FLOOR_ROOMS,
];

const CITATION_PATTERN = /\[cite:\s*(\d+)\]/gi;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractRoomNumber(name: string): string | null {
  const roomMatch = name.match(/room\s*no\.?\s*(\d+[a-z]?)/i);
  if (roomMatch) {
    return roomMatch[1].toUpperCase();
  }
  const lhMatch = name.match(/lh[-\s]*(\d+)/i);
  if (lhMatch) {
    return `LH-${lhMatch[1]}`;
  }
  const numberMatch = name.match(/\b\d{2,3}[a-z]?\b/);
  if (numberMatch) {
    return numberMatch[0].toUpperCase();
  }
  return null;
}

function sanitizeDirections(text: string): { sanitized: string; citations: number[] } {
  const citationSet = new Set<number>();
  const withoutMarkers = text.replace(/\[cite_start\]/g, '');
  const sanitized = withoutMarkers.replace(CITATION_PATTERN, (_match, value) => {
    const numeric = parseInt(value, 10);
    if (!Number.isNaN(numeric)) {
      citationSet.add(numeric);
      return `[${numeric}]`;
    }
    return '';
  });
  return {
    sanitized: sanitized.replace(/\s+/g, ' ').trim(),
    citations: Array.from(citationSet).sort((a, b) => a - b),
  };
}

function splitIntoSteps(text: string): string[] {
  const steps = text
    .split(/(?<=[.?!])\s+(?=[A-Z(])/)
    .map((step) => step.trim())
    .filter(Boolean);
  if (steps.length === 0 && text) {
    return [text];
  }
  return steps;
}

function expandKeywords(name: string, roomNumber: string | null): string[] {
  const keywords = new Set<string>();
  const lowerName = name.toLowerCase();
  keywords.add(lowerName);

  const normalized = lowerName
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized) {
    keywords.add(normalized);
  }

  if (roomNumber) {
    const lowerRoom = roomNumber.toLowerCase();
    keywords.add(lowerRoom);
    keywords.add(`room ${lowerRoom}`);
    keywords.add(`room no ${lowerRoom}`);
    keywords.add(`room number ${lowerRoom}`);
    keywords.add(lowerRoom.replace('-', ' '));
  }

  const lhMatch = name.match(/LH[-\s]*(\d+)/i);
  if (lhMatch) {
    const lectureHall = lhMatch[1];
    keywords.add(`lh ${lectureHall}`);
    keywords.add(`lh-${lectureHall}`);
    keywords.add(`lecture hall ${lectureHall}`);
  }

  if (normalized.includes('dept')) {
    keywords.add(normalized.replace('dept', 'department'));
  }

  const tokens = normalized.split(' ').filter((token) => token.length > 3 || /\d/.test(token));
  tokens.forEach((token) => keywords.add(token));

  return Array.from(keywords);
}

export const ALL_LOCATIONS: Location[] = RAW_ROOMS.map((room) => {
  const { level, label } = FLOOR_META[room.floor];
  const { sanitized, citations } = sanitizeDirections(room.directions);
  const steps = splitIntoSteps(sanitized);
  const roomNumber = extractRoomNumber(room.name);
  const keywords = expandKeywords(room.name, roomNumber);

  return {
    key: `${room.floor}-${slugify(room.name)}`,
    name: room.name,
    floor: level,
    floor_name: label,
    description: sanitized,
    steps,
    citations,
    keywords,
    startingPoint: STARTING_POINT,
    room_number: roomNumber,
    building: BUILDING_NAME,
    coordinates: null,
  };
});

