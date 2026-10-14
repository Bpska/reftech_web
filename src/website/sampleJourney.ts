export type RouteCoordinate = [number, number];

export type JourneyStop = {
  id: string;
  order: number;
  name: string;
  area: string;
  window: string;
  eta: string;
  coordinate: RouteCoordinate;
};

export const sampleJourney = {
  label: 'Sample interstate journey - not live customer data',
  tripId: 'DEMO-ECR-042',
  vehicle: 'WB 23 RF 2042',
  temperature: '2-8 C',
  distance: '1,680 km',
  duration: 'Approx. 21 hr',
  totalMinutes: 1260,
  depot: {
    name: 'Kolkata Regional Depot',
    coordinate: [88.364023, 22.57285] as RouteCoordinate,
  },
  stops: [
    { id: 's1', order: 1, name: 'Bhubaneswar Cold Hub', area: 'Odisha', window: 'Day 1 - 14:00-15:00', eta: 'Day 1, 14:35', coordinate: [85.824547, 20.296112] },
    { id: 's2', order: 2, name: 'Visakhapatnam Distribution', area: 'Andhra Pradesh', window: 'Day 1 - 21:00-22:00', eta: 'Day 1, 21:25', coordinate: [83.218448, 17.686934] },
    { id: 's3', order: 3, name: 'Vijayawada Medical Hub', area: 'Andhra Pradesh', window: 'Day 2 - 02:00-03:00', eta: 'Day 2, 02:20', coordinate: [80.648033, 16.506214] },
    { id: 's4', order: 4, name: 'Chennai Cold Store', area: 'Tamil Nadu', window: 'Day 2 - 08:00-09:00', eta: 'Day 2, 08:40', coordinate: [80.270678, 13.082697] },
  ] as JourneyStop[],
  route: [[88.364023,22.57285],[88.271513,22.613383],[88.087316,22.475149],[87.368674,22.382741],[87.406433,22.15232],[87.243276,21.798271],[86.89878,21.536107],[86.434659,21.001404],[86.22762,20.913098],[85.824547,20.296112],[85.190664,19.757518],[85.062613,19.388151],[84.782637,19.277129],[84.548714,18.893436],[84.097039,18.456311],[83.205051,17.822134],[83.218448,17.686934],[82.993787,17.690426],[82.721709,17.41166],[82.364881,17.241445],[82.123229,17.22973],[81.837736,17.040406],[81.54095,17.050013],[80.978943,16.622519],[80.648033,16.506214],[80.482544,16.279473],[80.164955,16.140146],[80.009013,15.728964],[80.073351,15.510054],[80.0134,14.468126],[79.858199,14.168586],[80.270678,13.082697]] as RouteCoordinate[],
};