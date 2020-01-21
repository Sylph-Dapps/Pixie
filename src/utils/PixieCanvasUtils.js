const drawCells = (canvas, rows, scaleFactor = 1) => {
  const ctx = canvas.getContext('2d');
  ctx.save();

  if(rows && rows.length > 0) {
    for(let a = 0; a < rows.length; a++) {
      for(let b = 0; b < rows[a].length; b++) {
        ctx.fillStyle = rows[a][b];
        ctx.fillRect(b * scaleFactor, a * scaleFactor, scaleFactor, scaleFactor);
      }
    }
  }
  
  ctx.restore();
};

const drawGrid = (canvas, rows, scaleFactor = 1) => {
  const ctx = canvas.getContext('2d');
  ctx.save();

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  ctx.translate(0.5, 0.5);
  for(let a = 0; a < rows.length; a++) {
    ctx.beginPath();
    ctx.moveTo(0, a * scaleFactor);
    ctx.lineTo(canvas.width, a * scaleFactor);
    ctx.stroke();
  }
  
  for(let b = 0; b < rows[0].length; b++) {
    ctx.beginPath();
    ctx.moveTo(b * scaleFactor, 0);
    ctx.lineTo(b * scaleFactor, canvas.height);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 1);
  ctx.lineTo(canvas.width, canvas.height - 1);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(canvas.width - 1, 0);
  ctx.lineTo(canvas.width - 1, canvas.height);
  ctx.stroke();
  ctx.translate(-0.5, -0.5);

  ctx.restore();
};

export {
  drawCells,
  drawGrid,
};