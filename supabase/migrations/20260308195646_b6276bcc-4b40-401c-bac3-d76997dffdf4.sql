
-- Insert all 5 programs
INSERT INTO programs (code, name, degree_type, total_credits) VALUES
  ('CS-GEN', 'Computer Science, General Track', 'BS', 120),
  ('CS-CYB', 'Computer Science, Cybersecurity Track', 'BS', 120),
  ('CYB', 'Cybersecurity', 'BS', 120),
  ('IT-GEN', 'Information Technology, General Track', 'BS', 120),
  ('IT-CYB', 'Information Technology, Cybersecurity Track', 'BS', 120)
ON CONFLICT DO NOTHING;

-- CS General Track - Core
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, req.cat, false, c.id
FROM programs p
CROSS JOIN (VALUES
  ('CSC 1750','core'),('CSC 1760','core'),('CSC 1850','core'),('CSC 2150','core'),
  ('CSC 2250','core'),('CSC 2260','core'),('CSC 2650','core'),('CSC 2850','core'),
  ('CSC 2920','core'),('CSC 3360','core'),('CSC 3750','core'),('CSC 4900','core'),
  ('MAT 2210','math'),('MAT 2220','math'),('MAT 3150','math'),('MAT 3280','math')
) AS req(code, cat)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'CS-GEN'
ON CONFLICT DO NOTHING;

-- CS General Track - Electives
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, 'track_elective', true, c.id
FROM programs p
CROSS JOIN (VALUES
  ('CSC 3380'),('CSC 3800'),('CSC 4010'),('CSC 4110'),('CSC 4450'),('CSC 4810'),
  ('CSC 4970'),('CYB 3020'),('CYB 4020'),('ITC 4200'),('CSC 3050')
) AS req(code)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'CS-GEN'
ON CONFLICT DO NOTHING;

-- CS Cybersecurity Track - Core (same as CS-GEN core)
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, req.cat, false, c.id
FROM programs p
CROSS JOIN (VALUES
  ('CSC 1750','core'),('CSC 1760','core'),('CSC 1850','core'),('CSC 2150','core'),
  ('CSC 2250','core'),('CSC 2260','core'),('CSC 2650','core'),('CSC 2850','core'),
  ('CSC 2920','core'),('CSC 3360','core'),('CSC 3750','core'),('CSC 4900','core'),
  ('MAT 2210','math'),('MAT 2220','math'),('MAT 3150','math'),('MAT 3280','math'),
  ('CYB 3020','cybersecurity')
) AS req(code, cat)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'CS-CYB'
ON CONFLICT DO NOTHING;

-- CS Cybersecurity Track - Electives
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, 'track_elective', true, c.id
FROM programs p
CROSS JOIN (VALUES
  ('CSC 3380'),('CYB 3500'),('CSC 3800'),('CYB 4020'),('CYB 4030'),('CYB 4120'),
  ('CYB 4600'),('CYB 4700'),('CYB 4800'),('CYB 4920'),('CYB 4220'),('CYB 4990'),('CYB 4970')
) AS req(code)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'CS-CYB'
ON CONFLICT DO NOTHING;

-- Cybersecurity BS - Core
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, req.cat, false, c.id
FROM programs p
CROSS JOIN (VALUES
  ('CSC 1750','core'),('CSC 1760','core'),('CSC 1850','core'),('CSC 2150','core'),
  ('CSC 2250','core'),('CSC 2260','core'),('CSC 2850','core'),('CSC 2920','core'),
  ('ITC 2080','core'),('CSC 3360','core'),('CYB 3020','cybersecurity'),
  ('CYB 4020','cybersecurity'),('CYB 4220','cybersecurity'),('CYB 4900','cybersecurity'),
  ('MAT 2100','math'),('MAT 2210','math')
) AS req(code, cat)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'CYB'
ON CONFLICT DO NOTHING;

-- Cybersecurity BS - Electives
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, 'major_elective', true, c.id
FROM programs p
CROSS JOIN (VALUES
  ('CSC 3380'),('CSC 3800'),('ITC 3300'),('ITC 4800'),('CYB 3500'),('CYB 4030'),
  ('CYB 4120'),('CYB 4600'),('CYB 4700'),('CYB 4800'),('CYB 4920'),('CYB 4970'),('CYB 4990')
) AS req(code)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'CYB'
ON CONFLICT DO NOTHING;

-- IT General Track - Core
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, req.cat, false, c.id
FROM programs p
CROSS JOIN (VALUES
  ('CSC 1300','core'),('CSC 1750','core'),('CSC 1760','core'),('CSC 1850','core'),
  ('CSC 2050','core'),('CSC 2150','core'),('CSC 2250','core'),('CSC 2260','core'),
  ('CSC 2850','core'),('CSC 2920','core'),('CSC 3050','core'),
  ('ITC 2080','core'),('ITC 3060','core'),('ITC 3300','core'),('ITC 4940','core'),
  ('MAT 2100','math'),('MAT 2150','math')
) AS req(code, cat)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'IT-GEN'
ON CONFLICT DO NOTHING;

-- IT General Track - Electives
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, 'track_elective', true, c.id
FROM programs p
CROSS JOIN (VALUES
  ('ITC 3070'),('ITC 3100'),('ITC 4100'),('ITC 4200'),('ITC 4800'),('ITC 4960'),
  ('CSC 3380'),('CSC 3750'),('CSC 3800'),('CSC 4110'),('CYB 3020'),('CYB 4020'),('CYB 4030')
) AS req(code)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'IT-GEN'
ON CONFLICT DO NOTHING;

-- IT Cybersecurity Track - Core
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, req.cat, false, c.id
FROM programs p
CROSS JOIN (VALUES
  ('CSC 1300','core'),('CSC 1750','core'),('CSC 1760','core'),('CSC 1850','core'),
  ('CSC 2050','core'),('CSC 2150','core'),('CSC 2250','core'),('CSC 2260','core'),
  ('CSC 2850','core'),('CSC 2920','core'),('CSC 3050','core'),
  ('ITC 2080','core'),('ITC 3060','core'),('ITC 3300','core'),('ITC 4940','core'),
  ('MAT 2100','math'),('MAT 2150','math'),('CYB 3020','cybersecurity')
) AS req(code, cat)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'IT-CYB'
ON CONFLICT DO NOTHING;

-- IT Cybersecurity Track - Electives
INSERT INTO program_requirements (program_id, course_code, category, is_elective, course_id)
SELECT p.id, req.code, 'track_elective', true, c.id
FROM programs p
CROSS JOIN (VALUES
  ('ITC 3070'),('ITC 4800'),('CSC 3380'),('CSC 3800'),('CYB 4020'),('CYB 4030'),
  ('CYB 4120'),('CYB 4220'),('CYB 4600'),('CYB 4700'),('CYB 4800'),('CYB 4920')
) AS req(code)
LEFT JOIN courses c ON c.department_prefix = split_part(req.code, ' ', 1) AND c.course_number = split_part(req.code, ' ', 2)
WHERE p.code = 'IT-CYB'
ON CONFLICT DO NOTHING;
