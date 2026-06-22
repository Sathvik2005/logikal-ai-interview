import { Candidate } from './candidate.entity';

export interface ICandidateRepository {
  findById(id: string): Promise<Candidate | null>;
  save(candidate: Candidate): Promise<void>;
  create(candidate: Candidate): Promise<void>;
}

export const ICandidateRepositoryToken = Symbol('ICandidateRepository');
