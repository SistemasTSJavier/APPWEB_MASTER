-- Ampliar teléfono (personal + casa combinados) y escolaridad en importaciones CSV.
ALTER TABLE `empleado_identidad` MODIFY COLUMN `telefono` VARCHAR(255) NULL;
ALTER TABLE `empleado_identidad` MODIFY COLUMN `escolaridad` VARCHAR(255) NULL;
