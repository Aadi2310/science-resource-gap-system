INSERT INTO resource_categories(name,importance_weight) VALUES
('Science Laboratory',100),('Physics Equipment',95),('Chemistry Equipment',95),
('Biology Equipment',90),('Computers/Computer Lab',85),('Connectivity & EdTech',70)
ON CONFLICT(name) DO NOTHING;
