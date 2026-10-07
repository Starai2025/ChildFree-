-- Adds six lighthearted prompts to the structured profile catalog (version 1 each).
-- Existing prompts and approved profile references are unchanged.
insert into private.prompt_catalog(id,version,text) values
('auntie_asks',1,'When Auntie asks ‘So when are y''all having kids?’ I say…'),
('rather_raise',1,'Things I''d rather raise than children…'),
('cookout_dish',1,'The cookout dish I''m trusted to bring is…'),
('dink_vacation',1,'Our future DINK vacation is…'),
('reunion_shirt',1,'The family reunion T-shirt I''d design for us says…'),
('college_fund',1,'Instead of a college fund, I''m funding…');
