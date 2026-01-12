
import React from 'react';
import { ServiceCategory, PredefinedService } from './types';

export const COLORS = {
  pine: '#163C39',
  seafoam: '#438883',
  mist: '#DAE7E6',
  cyan: '#2EA1B8',
  zinc: {
    950: '#f8fafc', // Inverted for light mode usage
    900: '#f1f5f9',
    800: '#e2e8f0',
    700: '#cbd5e1',
    600: '#94a3b8',
    500: '#64748b',
    400: '#475569',
    300: '#334155',
    200: '#1e293b',
    100: '#0f172a',
  },
};

export const COUNTRIES = [
  { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh' },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
  { code: 'EU', name: 'Germany', currency: 'EUR', symbol: '€' },
];

export const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Snake', 'Horse', 'Lizard', 'Parrot', 'Other'];

export const BREEDS: Record<string, string[]> = {
  'Dog': [
    'Mixed Breed', 'Rhodesian Ridgeback', 'German Shepherd', 'Golden Retriever', 
    'Labrador Retriever', 'Bulldog', 'Beagle', 'Poodle', 'Rottweiler', 
    'Yorkshire Terrier', 'Boxer', 'Dachshund'
  ],
  'Cat': [
    'Mixed Breed', 'Siamese', 'Persian', 'Maine Coon', 'Ragdoll', 
    'British Shorthair', 'Abyssinian', 'Sphynx', 'Bengal', 'Scottish Fold'
  ],
  'Bird': ['Budgerigar', 'Cockatiel', 'Lovebird', 'African Grey Parrot', 'Canary', 'Finch'],
  'Rabbit': ['Netherland Dwarf', 'Holland Lop', 'Mini Rex', 'Lionhead', 'Flemish Giant'],
  'Hamster': ['Syrian', 'Dwarf Campbell Russian', 'Roborovski', 'Chinese'],
  'Snake': ['Ball Python', 'Corn Snake', 'King Snake', 'Garter Snake'],
  'Horse': ['Arabian', 'Thoroughbred', 'Quarter Horse', 'Appaloosa', 'Morgan'],
  'Lizard': ['Bearded Dragon', 'Leopard Gecko', 'Green Iguana', 'Blue-Tongued Skink'],
  'Parrot': ['Macaw', 'Cockatoo', 'Amazon', 'Conure'],
  'Other': ['N/A']
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'cat-med', name: 'Medical', icon: '🩺' },
  { id: 'cat-vac', name: 'Vaccination', icon: '💉' },
  { id: 'cat-gro', name: 'Grooming', icon: '✂️' },
  { id: 'cat-sur', name: 'Surgery', icon: '🔪' },
  { id: 'cat-den', name: 'Dental', icon: '🦷' },
  { id: 'cat-con', name: 'Consultation', icon: '🗣️' },
  { id: 'cat-lab', name: 'Laboratory', icon: '🔬' },
];

export const PREDEFINED_SERVICES: PredefinedService[] = [
  { id: 'svc-1', categoryId: 'cat-med', name: 'General Health Check', basePrice: 1500 },
  { id: 'svc-2', categoryId: 'cat-vac', name: 'Rabies Shot', basePrice: 2000 },
  { id: 'svc-3', categoryId: 'cat-vac', name: 'Parvo/Distemper', basePrice: 2500 },
  { id: 'svc-4', categoryId: 'cat-gro', name: 'Full Groom', basePrice: 3500 },
  { id: 'svc-5', categoryId: 'cat-gro', name: 'Nail Trim', basePrice: 500 },
  { id: 'svc-6', categoryId: 'cat-sur', name: 'Neutering', basePrice: 15000 },
  { id: 'svc-7', categoryId: 'cat-den', name: 'Teeth Cleaning', basePrice: 8000 },
];
