export type Container = {
  id: string;
  container_number: string;
  status: string;
  created_at: string;
};

export type ContainerItem = {
  id: string;
  container_id: string;
  item_name: string;
  quantity: number;
  weight_kg: number | null;
  cbm: number | null;
  owner_name: string | null;
  width: number | null;
  length: number | null;
  height: number | null;
  notes: string | null;
  created_at: string;
};
