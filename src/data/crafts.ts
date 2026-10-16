// Work done out in the open that you can see and hear: the smith at the anvil, the minstrel at the fountain.

export const CRAFTS = {
  /** Seconds between strokes of the smith's hammer (each one throws sparks off the anvil). */
  hammer: 0.9,
  /** Seconds between the notes a minstrel's tune floats up (a range), and their colour. */
  notes: [0.7, 1.5] as readonly [number, number],
  note: "#f5d562",
  /** Seconds for a sweeper's broom to go one way and back (it kicks up dust at each end). */
  sweep: 1.3,
  /** Seconds for a laundress to scrub the wash down the board and back. */
  scrub: 0.55,
  /** Seconds for one turn of a well's crank. */
  crank: 1.6,
  /** Seconds between bites on a fisherman's line (each one dips the float, and he strikes). */
  bite: 11,
  /** Seconds round a falconer's hawk's day: on the fist, then up and wheeling overhead for the last `hawkFlight` of them, `hawkLaps` times round. */
  hawk: 18,
  hawkFlight: 6,
  hawkLaps: 2,
  /** Seconds for a bowyer's drawknife to come down the stave (and back up for the next shaving). */
  shave: 1.8,
  /** Seconds a fletcher takes over an arrow, binding on the feathers, before holding it up to sight along it. */
  fletch: 9,
  /** Seconds for a harness-maker to push the awl through and draw the thread out. */
  stitch: 1.4,
  /** Seconds between sparks off a grindstone. */
  sparks: 0.09,
  /** Seconds between a tinker's taps on the pot he's mending, and a mason's mallet on his chisel. */
  tap: 0.45,
  chisel: 0.8,
  /** Seconds between the lines of a storyteller's tale (a range), floated up over the square. */
  tale: [3.5, 6] as readonly [number, number],
  /** What a storyteller tells (carefully: the Edict has ears), a line at a time. */
  tales: [
    "...and the miller's daughter said...", "...three nights, and on the fourth...", "...so the King's own hound...",
    "...a light out on the marsh...", "...and something with wings — well.", "...but I mustn't say what.", "...and he never came back!",
  ] as readonly string[],
  tellColour: "#e8dcc4",
  /** Seconds for a cooper's blow on the hoop-driver, a carpenter's saw stroke there and back, a turn of a vat's paddle. */
  hoop: 0.7,
  saw: 0.8,
  stir: 2.4,
  /** Seconds for a spinner's spindle to drop, twisting the yarn, before she winds it up and sets it going again. */
  spin: 6,
  /**
   * The street lamps: the lamplighter goes round lighting them `from` this hour, and any he hasn't got to by `by`
   * are lit all the same; `crew` go round (he and the sweeps' helpers). At each lamp the pole's up to it `raise`
   * seconds before it catches, and down again by `stay`; between lamps they walk `pace` times as fast as they would.
   * At dawn they go out, one by one, over `dawn` hours from sunrise.
   */
  lamps: { from: 18, by: 20.5, crew: 3, raise: 1.1, stay: 1.8, pace: 1.5, dawn: 0.6 },
} as const;
