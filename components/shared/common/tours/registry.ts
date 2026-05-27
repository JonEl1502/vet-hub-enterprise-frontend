import { Users, Dog, CalendarClock } from 'lucide-react';
import type { Tour } from '../../../../contexts/TourContext';

export const TOURS: Tour[] = [
  {
    id: 'clients',
    name: 'Register a client',
    icon: Users,
    description: 'Walk through adding a new pet owner — the first record you usually create.',
    steps: [
      {
        target: 'nav-clients',
        title: 'Clients live here',
        body: 'The Clients module holds every pet owner. Click the sidebar entry to open it.',
        placement: 'right',
        navigateTo: 'clients',
      },
      {
        target: 'clients-register',
        title: 'Register a new client',
        body: 'Use this button to start a fresh client record. You can also bulk-import from CSV later.',
        placement: 'bottom',
      },
      {
        target: 'client-form-firstname',
        title: 'Names go here',
        body: 'First name + surname are required. Title and second name are optional but helpful for greetings on invoices.',
        placement: 'bottom',
        navigateTo: 'register-client',
      },
      {
        target: 'client-form-submit',
        title: 'Save the client',
        body: 'Once required fields are filled, save the record. You can attach pets to this client right after.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'pets',
    name: 'Register a patient',
    icon: Dog,
    description: 'Add a pet and link it to an owner — works for first-time patients and existing client records.',
    steps: [
      {
        target: 'nav-patients',
        title: 'Patients module',
        body: 'Every pet you treat lives here. Patients always belong to a client.',
        placement: 'right',
        navigateTo: 'patients',
      },
      {
        target: 'pets-register',
        title: 'Register a patient',
        body: 'Click here to add a new pet. You will pick the owner first, then enter the pet details.',
        placement: 'bottom',
      },
      {
        target: 'pet-form-owner',
        title: 'Pick the owner',
        body: 'Search by name, phone, or ID. If the owner is not in the system yet, register them first.',
        placement: 'bottom',
        navigateTo: 'register-pet',
      },
      {
        target: 'pet-form-name',
        title: 'Pet details',
        body: 'Give the pet a name and select species/breed. Microchip and tag numbers help identify lost pets later.',
        placement: 'top',
      },
      {
        target: 'pet-form-submit',
        title: 'Save the patient',
        body: 'Save once the form is filled. You can book an appointment for this pet straight away.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'appointments',
    name: 'Book an appointment',
    icon: CalendarClock,
    description: 'Schedule a visit — pick a client, a pet, services, and a time slot.',
    steps: [
      {
        target: 'nav-appointments',
        title: 'Appointments module',
        body: 'All visits — scheduled, in-progress, completed — show up here. Use it as your daily schedule view.',
        placement: 'right',
        navigateTo: 'appointments',
      },
      {
        target: 'appointments-new',
        title: 'Start a new visit',
        body: 'Click here to book a new appointment. Walk-ins use the same flow.',
        placement: 'bottom',
      },
      {
        target: 'appointment-client',
        title: 'Pick a client & pet',
        body: 'Search by name or phone, then pick which pet the visit is for. Walk-in clients can be created inline.',
        placement: 'bottom',
        navigateTo: 'new-appointment',
      },
      {
        target: 'appointment-submit',
        title: 'Confirm the booking',
        body: 'Estimated bill updates live based on services selected. Confirm to book the visit.',
        placement: 'top',
      },
    ],
  },
];
