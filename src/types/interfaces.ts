export interface ApiResponse {
  success: boolean,
  page?: number,
  page_size?: number,
  total_pages?: number,
  total_results: number,
  shows: Show[]
}

export interface Show {
  id: string,
  name: string,
  cast?: CastMember[]
}

export interface CastMember {
  id: string,
  name: string,
  birthday: string
}