
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
 * migrations **181 + 182** (Dog, Cat) and **240** (Bird, Rabbit, Hamster, Snake,
 * Horse, Lizard, Parrot); change those. Kept here only as a readable reference of
 * the intended set, and deliberately in step with them so it does not become a lie.
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
 *
 * The other seven species were brought off their stub lists on 2026-08-26 (the
 * rest of the same vet ask — Dogs and cats went first because the vet said so).
 * Same principle: Kenyan Sand Boa, Jackson's Chameleon, Rock Agama, Nile Monitor,
 * African House Snake, Somali Pony, Basuto Pony, Boerperd and Fischer's Lovebird
 * lead their lists, the international set follows.
 *
 * ⚠️ Every species now carries a **'Mixed Breed'** entry, and it is FIRST on
 * purpose. `/breeds` comes back sorted by name, so a form that defaults to the
 * first option defaults to whatever sorts first — "Akhal-Teke" for a horse — and
 * stamps a breed nobody chose onto a field reports group by. The pet form picks
 * 'Mixed Breed' explicitly instead; do not make any picker fall back to `[0]`.
 */
export const BREEDS: Record<string, string[]> = {
  'Dog': [
    'Mixed Breed', 'Kenyan Shepherd Dog (KSD)', 'Affenpinscher', 'Afghan Hound',
    'Airedale Terrier', 'Akita', 'Alaskan Klee Kai', 'Alaskan Malamute', 'American Bulldog',
    'American Cocker Spaniel', 'American Eskimo Dog', 'American Foxhound',
    'American Pit Bull Terrier', 'American Staffordshire Terrier', 'American Water Spaniel',
    'Anatolian Shepherd Dog', 'Appenzeller Sennenhund', 'Australian Cattle Dog',
    'Australian Kelpie', 'Australian Shepherd', 'Australian Terrier', 'Azawakh', 'Basenji',
    'Basset Hound', 'Bavarian Mountain Hound', 'Beagle', 'Bearded Collie', 'Beauceron',
    'Bedlington Terrier', 'Belgian Laekenois', 'Belgian Malinois',
    'Belgian Sheepdog (Groenendael)', 'Belgian Tervuren', 'Bergamasco Shepherd',
    'Berger Picard', 'Bernese Mountain Dog', 'Bichon Frise', 'Black and Tan Coonhound',
    'Black Russian Terrier', 'Bloodhound', 'Bluetick Coonhound', 'Boerboel', 'Bolognese',
    'Border Collie', 'Border Terrier', 'Borzoi', 'Boston Terrier', 'Bouvier des Flandres',
    'Boxer', 'Bracco Italiano', 'Briard', 'Brittany', 'Brussels Griffon', 'Bull Terrier',
    'Bulldog', 'Bullmastiff', 'Cairn Terrier', 'Canaan Dog', 'Cane Corso',
    'Cardigan Welsh Corgi', 'Catahoula Leopard Dog', 'Caucasian Shepherd Dog',
    'Cavalier King Charles Spaniel', 'Central Asian Shepherd Dog', 'Cesky Terrier',
    'Chesapeake Bay Retriever', 'Chihuahua', 'Chinese Crested', 'Chow Chow', 'Clumber Spaniel',
    'Cocker Spaniel', 'Coton de Tulear', 'Curly-Coated Retriever', 'Czechoslovakian Wolfdog',
    'Dachshund', 'Dalmatian', 'Dandie Dinmont Terrier', 'Doberman Pinscher', 'Dogo Argentino',
    'Dogue de Bordeaux', 'Dutch Shepherd', 'English Cocker Spaniel', 'English Foxhound',
    'English Setter', 'English Springer Spaniel', 'English Toy Spaniel',
    'Entlebucher Mountain Dog', 'Estrela Mountain Dog', 'Eurasier', 'Field Spaniel',
    'Finnish Lapphund', 'Finnish Spitz', 'Flat-Coated Retriever', 'French Bulldog',
    'German Pinscher', 'German Shepherd', 'German Shorthaired Pointer',
    'German Wirehaired Pointer', 'Giant Schnauzer', 'Glen of Imaal Terrier',
    'Golden Retriever', 'Gordon Setter', 'Great Dane', 'Great Pyrenees',
    'Greater Swiss Mountain Dog', 'Greenland Dog', 'Greyhound', 'Harrier', 'Havanese',
    'Hovawart', 'Ibizan Hound', 'Icelandic Sheepdog', 'Irish Red and White Setter',
    'Irish Setter', 'Irish Terrier', 'Irish Water Spaniel', 'Irish Wolfhound',
    'Italian Greyhound', 'Jack Russell Terrier', 'Japanese Chin', 'Japanese Spitz',
    'Kangal Shepherd Dog', 'Karelian Bear Dog', 'Keeshond', 'Kerry Blue Terrier', 'Komondor',
    'Kooikerhondje', 'Kuvasz', 'Labrador Retriever', 'Lagotto Romagnolo', 'Lakeland Terrier',
    'Leonberger', 'Lhasa Apso', 'Lowchen', 'Maltese', 'Manchester Terrier', 'Maremma Sheepdog',
    'Mastiff', 'Miniature American Shepherd', 'Miniature Bull Terrier', 'Miniature Pinscher',
    'Miniature Schnauzer', 'Neapolitan Mastiff', 'Newfoundland', 'Norfolk Terrier',
    'Norwegian Buhund', 'Norwegian Elkhound', 'Norwich Terrier',
    'Nova Scotia Duck Tolling Retriever', 'Old English Sheepdog', 'Otterhound', 'Papillon',
    'Parson Russell Terrier', 'Pekingese', 'Pembroke Welsh Corgi',
    'Petit Basset Griffon Vendeen', 'Pharaoh Hound', 'Plott Hound', 'Pointer',
    'Polish Lowland Sheepdog', 'Pomeranian', 'Poodle', 'Poodle (Miniature)', 'Poodle (Toy)',
    'Portuguese Podengo', 'Portuguese Water Dog', 'Presa Canario', 'Pug', 'Puli', 'Pumi',
    'Pyrenean Mastiff', 'Pyrenean Shepherd', 'Rat Terrier', 'Redbone Coonhound',
    'Rhodesian Ridgeback', 'Rottweiler', 'Rough Collie', 'Russian Toy', 'Saint Bernard',
    'Saluki', 'Samoyed', 'Schipperke', 'Scottish Deerhound', 'Scottish Terrier',
    'Sealyham Terrier', 'Shar Pei', 'Shetland Sheepdog', 'Shiba Inu', 'Shih Tzu',
    'Siberian Husky', 'Silky Terrier', 'Skye Terrier', 'Sloughi', 'Smooth Collie',
    'Smooth Fox Terrier', 'Soft Coated Wheaten Terrier', 'Spanish Water Dog',
    'Spinone Italiano', 'Staffordshire Bull Terrier', 'Stabyhoun', 'Sussex Spaniel',
    'Swedish Vallhund', 'Thai Ridgeback', 'Tibetan Mastiff', 'Tibetan Spaniel',
    'Tibetan Terrier', 'Tosa Inu', 'Toy Fox Terrier', 'Treeing Walker Coonhound', 'Vizsla',
    'Weimaraner', 'Welsh Springer Spaniel', 'Welsh Terrier', 'West Highland White Terrier',
    'Whippet', 'Wire Fox Terrier', 'Wirehaired Pointing Griffon', 'Wirehaired Vizsla',
    'Xoloitzcuintli', 'Yorkshire Terrier',
    'Other'
  ],
  'Cat': [
    'Mixed Breed', 'Abyssinian', 'Aegean', 'American Bobtail', 'American Curl',
    'American Shorthair', 'American Wirehair', 'Arabian Mau', 'Asian', 'Australian Mist',
    'Balinese', 'Bambino', 'Bengal', 'Birman', 'Bombay', 'Brazilian Shorthair',
    'British Longhair', 'British Shorthair', 'Burmese', 'Burmilla', 'California Spangled',
    'Chantilly-Tiffany', 'Chartreux', 'Chausie', 'Colorpoint Shorthair', 'Cornish Rex',
    'Cymric', 'Cyprus', 'Devon Rex', 'Domestic Long Hair', 'Domestic Short Hair', 'Donskoy',
    'Dragon Li', 'Egyptian Mau', 'European Shorthair', 'Exotic Shorthair', 'Havana Brown',
    'Highlander', 'Himalayan', 'Japanese Bobtail', 'Javanese', 'Khao Manee', 'Korat',
    'Kurilian Bobtail', 'LaPerm', 'Lykoi', 'Maine Coon', 'Manx', 'Munchkin', 'Nebelung',
    'Norwegian Forest', 'Ocicat', 'Oriental Longhair', 'Oriental Shorthair', 'Persian',
    'Peterbald', 'Pixie-bob', 'Ragamuffin', 'Ragdoll', 'Russian Blue', 'Savannah',
    'Scottish Fold', 'Selkirk Rex', 'Serengeti', 'Siamese', 'Siberian', 'Singapura',
    'Snowshoe', 'Sokoke', 'Somali', 'Sphynx', 'Thai', 'Tonkinese', 'Toyger', 'Turkish Angora',
    'Turkish Van', 'Ukrainian Levkoy',
    'Other'
  ],
  'Bird': ['Mixed Breed', 'Budgerigar', 'Cockatiel', 'Lovebird', 'African Grey Parrot',
    'Canary', 'Finch', 'Fischer\'s Lovebird', 'Peach-faced Lovebird', 'Masked Lovebird',
    'Senegal Parrot', 'Meyer\'s Parrot', 'Jardine\'s Parrot', 'Indian Ringneck Parakeet',
    'Cordon-bleu Finch', 'Domestic Pigeon', 'Guinea Fowl', 'Peafowl (Peacock)', 'Amazon Parrot',
    'Barbary Dove', 'Bengalese Finch', 'Blue-and-Gold Macaw', 'Border Canary', 'Caique',
    'Cockatoo', 'Diamond Dove', 'Eclectus Parrot', 'Fantail Pigeon', 'Fife Canary',
    'Gloster Canary', 'Gouldian Finch', 'Green-cheeked Conure', 'Java Sparrow', 'Lorikeet',
    'Pionus Parrot', 'Quaker Parrot (Monk Parakeet)', 'Racing Homer Pigeon',
    'Red Factor Canary', 'Ringneck Dove', 'Scarlet Macaw', 'Society Finch', 'Sun Conure',
    'Yorkshire Canary', 'Zebra Finch'],
  'Rabbit': ['Mixed Breed', 'Netherland Dwarf', 'Holland Lop', 'Mini Rex', 'Lionhead',
    'Flemish Giant', 'New Zealand', 'Californian', 'Standard Chinchilla', 'Dutch', 'Rex',
    'American', 'American Chinchilla', 'American Fuzzy Lop', 'American Sable', 'Argente Brun',
    'Belgian Hare', 'Beveren', 'Blanc de Hotot', 'Britannia Petite', 'Champagne d\'Argent',
    'Checkered Giant', 'Cinnamon', 'Continental Giant', 'Crème d\'Argent', 'Dwarf Hotot',
    'English Angora', 'English Lop', 'English Spot', 'Florida White', 'French Angora',
    'French Lop', 'Giant Angora', 'Giant Chinchilla', 'Harlequin', 'Havana', 'Himalayan',
    'Jersey Wooly', 'Lilac', 'Mini Lop', 'Mini Satin', 'Palomino', 'Polish', 'Rhinelander',
    'Satin', 'Satin Angora', 'Silver', 'Silver Fox', 'Silver Marten', 'Tan', 'Thrianta',
    'Velveteen Lop'],
  'Hamster': ['Mixed Breed', 'Syrian', 'Dwarf Campbell Russian', 'Roborovski', 'Chinese',
    'Campbell\'s Dwarf Russian', 'Hybrid Dwarf', 'Syrian (Black Bear)',
    'Syrian (Long-haired / Teddy Bear)', 'Syrian (Rex)', 'Syrian (Satin)',
    'Winter White Russian Dwarf'],
  'Snake': ['Mixed Breed', 'Ball Python', 'Corn Snake', 'King Snake', 'Garter Snake',
    'Kenyan Sand Boa', 'African House Snake', 'Brown House Snake', 'African Egg-eating Snake',
    'Mole Snake', 'Rat Snake', 'Blood Python', 'Boa Constrictor', 'Brazilian Rainbow Boa',
    'Bullsnake', 'Burmese Python', 'Carpet Python', 'Children\'s Python', 'Emerald Tree Boa',
    'Green Tree Python', 'Milk Snake', 'Red-tailed Boa', 'Reticulated Python', 'Rosy Boa',
    'Rubber Boa', 'Spotted Python', 'Western Hognose Snake'],
  'Horse': ['Mixed Breed', 'Arabian', 'Thoroughbred', 'Quarter Horse', 'Appaloosa', 'Morgan',
    'Somali Pony', 'Basuto Pony', 'Boerperd', 'Nooitgedacht Pony', 'Barb', 'Anglo-Arabian',
    'Grade Horse (Mixed)', 'Akhal-Teke', 'American Paint Horse', 'American Saddlebred',
    'Andalusian', 'Ardennes', 'Belgian Draft', 'Camargue', 'Cleveland Bay', 'Clydesdale',
    'Connemara Pony', 'Criollo', 'Dales Pony', 'Dartmoor Pony', 'Dutch Warmblood',
    'Exmoor Pony', 'Falabella', 'Fell Pony', 'Friesian', 'Gypsy Vanner', 'Hackney', 'Haflinger',
    'Hanoverian', 'Highland Pony', 'Holsteiner', 'Icelandic Horse', 'Irish Draught',
    'Kathiawari', 'Knabstrupper', 'Lipizzaner', 'Lusitano', 'Marwari', 'Missouri Fox Trotter',
    'Mustang', 'New Forest Pony', 'Norwegian Fjord', 'Oldenburg', 'Orlov Trotter', 'Percheron',
    'Peruvian Paso', 'Pony of the Americas', 'Rocky Mountain Horse', 'Selle Français',
    'Shetland Pony', 'Shire', 'Standardbred', 'Suffolk Punch', 'Swedish Warmblood',
    'Tennessee Walking Horse', 'Trakehner', 'Welsh Cob (Section D)',
    'Welsh Mountain Pony (Section A)', 'Westphalian'],
  'Lizard': ['Mixed Breed', 'Bearded Dragon', 'Leopard Gecko', 'Green Iguana',
    'Blue-Tongued Skink', 'Jackson\'s Chameleon', 'Flap-necked Chameleon', 'Rock Agama',
    'Red-headed Agama', 'Nile Monitor', 'Common House Gecko', 'Ackie Monitor',
    'African Fat-tailed Gecko', 'Argentine Black and White Tegu', 'Chinese Water Dragon',
    'Collared Lizard', 'Crested Gecko', 'Frilled Dragon', 'Gargoyle Gecko', 'Giant Day Gecko',
    'Gold Dust Day Gecko', 'Green Anole', 'Leachianus Gecko', 'Mali Uromastyx',
    'Panther Chameleon', 'Red-eyed Crocodile Skink', 'Rhinoceros Iguana', 'Sailfin Dragon',
    'Savannah Monitor', 'Veiled Chameleon'],
  'Parrot': ['Mixed Breed', 'Macaw', 'Cockatoo', 'Amazon', 'Conure', 'African Grey (Congo)',
    'African Grey (Timneh)', 'Fischer\'s Lovebird', 'Peach-faced Lovebird', 'Senegal Parrot',
    'Meyer\'s Parrot', 'Brown-headed Parrot', 'Jardine\'s Parrot', 'Indian Ringneck Parakeet',
    'Black-headed Caique', 'Blue-and-Gold Macaw', 'Blue-fronted Amazon', 'Blue-headed Pionus',
    'Budgerigar', 'Cockatiel', 'Eclectus', 'Galah (Rose-breasted Cockatoo)',
    'Green-cheeked Conure', 'Green-winged Macaw', 'Hahn\'s Macaw', 'Hyacinth Macaw',
    'Military Macaw', 'Moluccan Cockatoo', 'Nanday Conure', 'Orange-winged Amazon',
    'Quaker Parrot (Monk Parakeet)', 'Rainbow Lorikeet', 'Red-bellied Parrot', 'Scarlet Macaw',
    'Severe Macaw', 'Sulphur-crested Cockatoo', 'Sun Conure', 'Umbrella Cockatoo',
    'White-bellied Caique', 'Yellow-naped Amazon'],
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
