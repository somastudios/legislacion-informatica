-- La función «portal» usa el rol de servicio para crear y enlazar cuentas.
grant select, insert, update, delete on all tables in schema public to service_role;
