
import React from 'react';
import { Stethoscope, FlaskConical, Microscope, BedDouble, Zap, Bone, Eye, Heart, Scissors, Activity, Star, Crown, AlertTriangle, Skull, Bath, Home } from 'lucide-react';
import { ClientType } from './types';
import { ServiceCategory, PredefinedService } from './types';

export type ClinicSpecialty =
  | 'Surgical'
  | 'Laboratory'
  | 'Imaging'
  | 'In-patient'
  | 'Emergency'
  | 'Grooming'
  | 'Boarding'
  | 'Dentistry'
  | 'Orthopedics'
  | 'Ophthalmology'
  | 'Cardiology'
  | 'Dermatology';

export const CLINIC_SPECIALTIES: { value: ClinicSpecialty; label: string; icon: React.ReactNode }[] = [
  { value: 'Surgical',     label: 'Surgical',     icon: <Stethoscope size={11} /> },
  { value: 'Laboratory',   label: 'Laboratory',   icon: <FlaskConical size={11} /> },
  { value: 'Imaging',      label: 'Imaging',      icon: <Microscope size={11} /> },
  { value: 'In-patient',   label: 'In-patient',   icon: <BedDouble size={11} /> },
  { value: 'Emergency',    label: 'Emergency',    icon: <Zap size={11} /> },
  // Named exactly like the service categories ("Grooming"/"Boarding") so
  // negotiated handshake prices match task.category on outsourcing.
  { value: 'Grooming',     label: 'Grooming',     icon: <Bath size={11} /> },
  { value: 'Boarding',     label: 'Boarding',     icon: <Home size={11} /> },
  { value: 'Dentistry',    label: 'Dentistry',    icon: <Scissors size={11} /> },
  { value: 'Orthopedics',  label: 'Orthopedics',  icon: <Bone size={11} /> },
  { value: 'Ophthalmology',label: 'Ophthalmology',icon: <Eye size={11} /> },
  { value: 'Cardiology',   label: 'Cardiology',   icon: <Heart size={11} /> },
  { value: 'Dermatology',  label: 'Dermatology',  icon: <Activity size={11} /> },
];

export const CLIENT_TYPES: {
  value: ClientType;
  label: string;
  icon: React.ReactNode;
  color: string;       // tailwind text color
  bg: string;          // tailwind bg color
  description: string; // default placeholder for clientTypeNote
}[] = [
  {
    value: 'VERY_RISKY',
    label: 'Very Risky',
    icon: <Skull size={11} />,
    color: 'text-red-500',
    bg: 'bg-red-500/10 border-red-500/30',
    description: 'Aggressive client, does not pay, or has serious history of issues.',
  },
  {
    value: 'RISKY',
    label: 'Risky',
    icon: <AlertTriangle size={11} />,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10 border-orange-500/30',
    description: 'Client has a history of late payments or disputes.',
  },
  {
    value: 'VALUED',
    label: 'Valued',
    icon: <Activity size={11} />,
    color: 'text-seafoam',
    bg: 'bg-seafoam/10 border-seafoam/30',
    description: 'Regular client in good standing.',
  },
  {
    value: 'HIGH_VALUE',
    label: 'High Value',
    icon: <Star size={11} />,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/30',
    description: 'Top-tier client, consistently pays on time and spends generously.',
  },
  {
    value: 'VERY_HIGH_VALUE',
    label: 'Very High Value',
    icon: <Crown size={11} />,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10 border-purple-500/30',
    description: 'Premium client with exceptional lifetime value and loyalty.',
  },
];

export const COLORS = {
  pine: '#144E35',
  seafoam: '#1C7A5B',
  mist: '#CFE6D8',
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

/**
 * Breed lists for the species picker.
 *
 * ⚠️⚠️ THIS CONSTANT IS NOT WIRED TO ANYTHING (verified 2026-08-06: `BREEDS` is
 * exported and imported by NO file, so the bundler tree-shakes it out entirely).
 * The breed picker reads the DATABASE — `useReferenceData()` → `GET /breeds` —
 * and its only fallback is the literal `['Mixed Breed']` in `RegisterPetView`.
 * **Editing this list changes nothing a user sees.** The live list is backend
 * migration 181; change that. Kept here only as a readable reference of the
 * intended set, and deliberately in step with 181 so it does not become a lie.
 *
 * ⚠️ ORDERED FOR A KENYAN PRACTICE, not alphabetically. The vet's note
 * (2026-08-06): *"Add more breeds both dogs and cats including the KSD the
 * Kenyan Shepherd Dog. It falls under mixed but most clients nowadays prefer
 * this."* So **Kenyan Shepherd Dog (KSD)** is its own entry rather than being
 * folded into Mixed Breed — what the owner calls the dog is what goes on the
 * record, and a breed nobody can select is a breed that gets typed as free text
 * and then cannot be reported on.
 *
 * The locally common ones lead each list (Japanese Spitz, Boerboel, Basenji,
 * Sokoke — the last two are African, the Sokoke is Kenyan). Everything after
 * that is the usual international set.
 */
export const BREEDS: Record<string, string[]> = {
  'Dog': [
    'Mixed Breed', 'Kenyan Shepherd Dog (KSD)',
    // Common in Kenyan practice.
    'German Shepherd', 'Japanese Spitz', 'Rhodesian Ridgeback', 'Boerboel',
    'Rottweiler', 'Doberman Pinscher', 'Jack Russell Terrier', 'Basenji',
    'Maltese', 'Shih Tzu', 'Bull Terrier', 'American Pit Bull Terrier',
    'Cane Corso', 'Belgian Malinois', 'Pomeranian', 'Chihuahua',
    // Wider international set.
    'Golden Retriever', 'Labrador Retriever', 'Bulldog', 'Beagle', 'Poodle',
    'Yorkshire Terrier', 'Boxer', 'Dachshund', 'Border Collie', 'Cocker Spaniel',
    'Dalmatian', 'Great Dane', 'Saint Bernard', 'Siberian Husky', 'Samoyed',
    'Pug', 'Lhasa Apso', 'Shar Pei', 'Weimaraner', 'Whippet', 'Greyhound',
    'Akita', 'Chow Chow', 'Bernese Mountain Dog', 'Newfoundland',
    'Staffordshire Bull Terrier', 'Alaskan Malamute', 'Papillon', 'Bichon Frise',
    'Other',
  ],
  'Cat': [
    'Mixed Breed', 'Domestic Short Hair', 'Domestic Long Hair',
    // Sokoke is a Kenyan landrace breed.
    'Sokoke', 'Siamese', 'Persian', 'Maine Coon', 'Ragdoll',
    'British Shorthair', 'Abyssinian', 'Sphynx', 'Bengal', 'Scottish Fold',
    'Russian Blue', 'Birman', 'Burmese', 'Norwegian Forest', 'Turkish Angora',
    'Turkish Van', 'Somali', 'Oriental Shorthair', 'Savannah', 'Tonkinese',
    'Devon Rex', 'Cornish Rex', 'Manx', 'Exotic Shorthair', 'Himalayan',
    'Ragamuffin', 'American Shorthair', 'Chartreux', 'Balinese', 'Singapura',
    'Other',
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
