/**
 * Import schemas — column definitions per entity. Drives the template download,
 * the preview table header, and the client-side validator. Keep in sync with
 * the backend import.service.ts accepted keys.
 */

export type ImportEntity = 'clients' | 'pets' | 'inventory' | 'staff';

export interface ColumnDef {
  key: string;             // primary column name used in CSV/template
  label: string;           // human-friendly label
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'enum';
  enumValues?: string[];
  example?: string;
  help?: string;
  aliases?: string[];      // alternate accepted header names (backend also tolerates these)
}

export interface EntitySchema {
  entity: ImportEntity;
  title: string;
  subtitle: string;
  columns: ColumnDef[];
  sampleRows: Record<string, string>[];
}

export const CLIENT_SCHEMA: EntitySchema = {
  entity: 'clients',
  title: 'Clients',
  subtitle: 'Pet owners and their contact details.',
  columns: [
    { key: 'title',       label: 'Title',       example: 'Dr.' },
    { key: 'first_name',  label: 'First name',  required: true, example: 'Amina',  aliases: ['firstName'] },
    { key: 'second_name', label: 'Middle name', example: 'W.', aliases: ['secondName', 'middle_name'] },
    { key: 'surname',     label: 'Surname',     required: true, example: 'Otieno', aliases: ['last_name', 'lastName'] },
    { key: 'email',       label: 'Email',       example: 'amina@example.com' },
    { key: 'phone',       label: 'Phone',       required: true, example: '+254712345678' },
    { key: 'address',     label: 'Address',     example: 'Kilimani, Nairobi' },
    { key: 'country',     label: 'Country',     example: 'Kenya',  help: 'Defaults to Kenya' },
    { key: 'currency',    label: 'Currency',    example: 'KES',    help: 'ISO 4217 code. Defaults to KES' },
    { key: 'gender',      label: 'Gender',      example: 'F' },
    { key: 'dob',         label: 'Date of birth', type: 'date', example: '1988-04-12', help: 'YYYY-MM-DD' },
  ],
  sampleRows: [
    {
      title: 'Dr.', first_name: 'Amina', second_name: '', surname: 'Otieno',
      email: 'amina@example.com', phone: '+254712345678',
      address: 'Kilimani, Nairobi', country: 'Kenya', currency: 'KES',
      gender: 'F', dob: '1988-04-12',
    },
    {
      title: '', first_name: 'Kevin', second_name: '', surname: 'Mokoena',
      email: '', phone: '+27821234567',
      address: 'Cape Town', country: 'South Africa', currency: 'ZAR',
      gender: 'M', dob: '',
    },
  ],
};

export const PET_SCHEMA: EntitySchema = {
  entity: 'pets',
  title: 'Pets',
  subtitle: 'Patient records. Each pet must link to an existing client by email or phone.',
  columns: [
    { key: 'name',              label: 'Pet name',     required: true, example: 'Simba' },
    { key: 'species',           label: 'Species',      required: true, example: 'Dog' },
    { key: 'breed',             label: 'Breed',        example: 'Labrador' },
    { key: 'gender',            label: 'Gender',       example: 'M' },
    { key: 'dob',               label: 'Date of birth', type: 'date', required: true, example: '2022-05-10', help: 'YYYY-MM-DD' },
    { key: 'weight_kg',         label: 'Weight (kg)',  type: 'number', example: '12.4', aliases: ['weight', 'weight_value'] },
    { key: 'rfid_chip_number',  label: 'RFID chip #',  example: '981020000123456', aliases: ['rfid'] },
    { key: 'tag_number',        label: 'Tag #',        example: 'A-001', aliases: ['tag'] },
    { key: 'owner_email',       label: 'Owner email',  example: 'amina@example.com', help: 'Either owner_email or owner_phone is required' },
    { key: 'owner_phone',       label: 'Owner phone',  example: '+254712345678' },
  ],
  sampleRows: [
    {
      name: 'Simba', species: 'Dog', breed: 'Labrador', gender: 'M',
      dob: '2022-05-10', weight_kg: '12.4', rfid_chip_number: '', tag_number: 'A-001',
      owner_email: 'amina@example.com', owner_phone: '+254712345678',
    },
    {
      name: 'Mittens', species: 'Cat', breed: 'British Shorthair', gender: 'F',
      dob: '2023-02-18', weight_kg: '4.1', rfid_chip_number: '', tag_number: '',
      owner_email: '', owner_phone: '+27821234567',
    },
  ],
};

export const INVENTORY_SCHEMA: EntitySchema = {
  entity: 'inventory',
  title: 'Inventory',
  subtitle: 'Medicines, consumables, and equipment stocked in your clinic.',
  columns: [
    { key: 'name',          label: 'Item name', required: true, example: 'Amoxicillin 250mg' },
    { key: 'category',      label: 'Category',  required: true, example: 'Antibiotic' },
    { key: 'sku',           label: 'SKU',       required: true, example: 'AMX-250', help: 'Must be unique' },
    { key: 'quantity',      label: 'Quantity',  type: 'number', example: '120' },
    { key: 'min_threshold', label: 'Reorder at', type: 'number', example: '10', aliases: ['minThreshold', 'reorder_point'] },
    { key: 'unit',          label: 'Unit',      example: 'Tablets' },
    { key: 'price',         label: 'Sell price', type: 'number', example: '25.00' },
    { key: 'cost_price',    label: 'Cost price', type: 'number', example: '12.50', aliases: ['costPrice'] },
    { key: 'batch_number',  label: 'Batch #',    example: 'B-2026-03' },
    { key: 'expiry_date',   label: 'Expiry date', type: 'date', example: '2027-06-30', help: 'YYYY-MM-DD' },
  ],
  sampleRows: [
    {
      name: 'Amoxicillin 250mg', category: 'Antibiotic', sku: 'AMX-250',
      quantity: '120', min_threshold: '20', unit: 'Tablets',
      price: '25.00', cost_price: '12.50', batch_number: 'B-2026-03', expiry_date: '2027-06-30',
    },
    {
      name: 'Syringe 5ml', category: 'Consumables', sku: 'SYR-5ML',
      quantity: '500', min_threshold: '50', unit: 'Units',
      price: '10.00', cost_price: '6.00', batch_number: '', expiry_date: '',
    },
  ],
};

export const STAFF_SCHEMA: EntitySchema = {
  entity: 'staff',
  title: 'Staff',
  subtitle: 'Team members. Invited users activate via forgot-password.',
  columns: [
    { key: 'email',       label: 'Email',      required: true, example: 'dr.otieno@example.com' },
    { key: 'title',       label: 'Title',      example: 'Dr.' },
    { key: 'first_name',  label: 'First name', required: true, example: 'Amina', aliases: ['firstName'] },
    { key: 'second_name', label: 'Middle name', example: '', aliases: ['secondName'] },
    { key: 'surname',     label: 'Surname',    required: true, example: 'Otieno', aliases: ['last_name', 'lastName'] },
    {
      key: 'role',
      label: 'Role',
      required: true,
      type: 'enum',
      enumValues: ['VET', 'STAFF', 'CLINIC_OWNER', 'FREELANCER'],
      example: 'VET',
    },
    { key: 'phone',       label: 'Phone',      example: '+254712345678' },
  ],
  sampleRows: [
    {
      email: 'dr.otieno@example.com', title: 'Dr.', first_name: 'Amina',
      second_name: '', surname: 'Otieno', role: 'VET', phone: '+254712345678',
    },
    {
      email: 'kevin@example.com', title: 'Mr.', first_name: 'Kevin',
      second_name: '', surname: 'Mokoena', role: 'STAFF', phone: '+27821234567',
    },
  ],
};

export const SCHEMAS: Record<ImportEntity, EntitySchema> = {
  clients:   CLIENT_SCHEMA,
  pets:      PET_SCHEMA,
  inventory: INVENTORY_SCHEMA,
  staff:     STAFF_SCHEMA,
};

export const getSchema = (entity: ImportEntity): EntitySchema => SCHEMAS[entity];
