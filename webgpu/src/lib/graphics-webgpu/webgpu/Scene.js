// Scene.js
import Cube from './objects/cube';

export default class Scene {
  constructor(device, renderPipeline2D, renderPipeline3D, camera) {
    this.device = device;
    this.renderPipeline2D = renderPipeline2D;
    this.renderPipeline3D = renderPipeline3D;
    this.camera = camera;
    this.cube = new Cube(device); // Initialize the cube
  }

  render(commandEncoder, textureView) {
    // Render 2D background
    const renderPassDescriptor2D = {
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1 }, // Black background
        },
      ],
    };

    const passEncoder2D = commandEncoder.beginRenderPass(renderPassDescriptor2D);
    passEncoder2D.setPipeline(this.renderPipeline2D.pipeline);
    passEncoder2D.setBindGroup(0, this.renderPipeline2D.bindGroup);
    passEncoder2D.draw(3, 1, 0, 0);
    passEncoder2D.end();

    // Render 3D cube
    const renderPassDescriptor3D = {
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'load', // Load previous content
          storeOp: 'store',
        },
      ],
    };

    const passEncoder3D = commandEncoder.beginRenderPass(renderPassDescriptor3D);
    passEncoder3D.setPipeline(this.renderPipeline3D.pipeline);
    passEncoder3D.setBindGroup(0, this.renderPipeline3D.bindGroup);
    passEncoder3D.setVertexBuffer(0, this.cube.getVertexBuffer());
    passEncoder3D.setIndexBuffer(this.cube.getIndexBuffer(), 'uint16');
    passEncoder3D.drawIndexed(this.cube.getIndexCount(), 1, 0, 0, 0);
    passEncoder3D.end();
  }
}
