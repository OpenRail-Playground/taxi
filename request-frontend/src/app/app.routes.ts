import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'journey-data' },
  {
    path: 'journey-data',
    title: 'Journey Data',
    data: { headerMode: 'home' },
    loadComponent: () =>
      import('./pages/journey-data/journey-data').then(m => m.JourneyData),
  },
  {
    path: 'journey',
    title: 'Journey',
    data: { headerMode: 'home' },
    loadComponent: () => import('./pages/journey/journey').then(m => m.Journey),
  },
  {
    path: 'passenger-data',
    title: 'Passenger Data',
    data: { headerMode: 'step' },
    loadComponent: () =>
      import('./pages/passenger-data/passenger-data').then(
        m => m.PassengerData
      ),
  },
  {
    path: 'confirmation',
    title: 'Confirm your request',
    data: { headerMode: 'step' },
    loadComponent: () =>
      import('./pages/confirmation/confirmation').then(m => m.Confirmation),
  },
  { path: '**', redirectTo: 'journey-data' },
];
