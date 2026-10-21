export async function recordBarangayActivity(connection, actorId, action, barangay) {
  await connection.execute(
    `INSERT INTO activity_logs (
       actor_id, actor_role, action, entity_type, entity_id, description
     ) VALUES (?, 'admin', ?, 'barangay', ?, ?)`,
    [actorId, action, barangay.id, barangay.name + ', Pio Duran, Albay'],
  );
}
