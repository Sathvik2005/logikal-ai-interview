import { Interview } from "./interview.entity";

export interface IInterviewRepository {
  findById(id: string): Promise<Interview | null>;
  save(interview: Interview): Promise<void>;
  create(interview: Interview): Promise<void>;
}

export const IInterviewRepositoryToken = Symbol("IInterviewRepository");
