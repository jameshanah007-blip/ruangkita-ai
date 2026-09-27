create unique index if not exists james_model_registry_learning_job_candidate_uidx
on public.james_model_registry(learning_job_id, candidate_model)
where learning_job_id is not null and candidate_model is not null;
