interface Cell {
  i: number;
  j: number;
}

interface Coin {
  cell: Cell;
  serial: string;
}

interface Cache {
  Coins: Array<Coin>;
}
