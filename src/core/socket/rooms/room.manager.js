export class RoomManager {
  /**
   * @param {import('socket.io').Server} io
   */
  constructor(io) {
    this.io = io;
  }

  async join(socket, roomId) {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('Invalid room id');
    }
    await socket.join(roomId);
    socket.to(roomId).emit('room:user-joined', {
      roomId,
      userId: socket.user?.id,
      socketId: socket.id,
    });
  }

  async leave(socket, roomId) {
    await socket.leave(roomId);
    socket.to(roomId).emit('room:user-left', {
      roomId,
      userId: socket.user?.id,
      socketId: socket.id,
    });
  }

  emitToRoom(roomId, event, payload) {
    this.io.to(roomId).emit(event, payload);
  }
}
