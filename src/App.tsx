import { useState, useRef } from 'react';

interface ProcessedImage {
  original: string;
  processed: string;
  name: string;
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [watermarkType, setWatermarkType] = useState<'image' | 'text'>('image');
  const [fontSize, setFontSize] = useState<number>(40);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [position, setPosition] = useState<string>('bottom-right');
  const [opacity, setOpacity] = useState<number>(0.5);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setProcessedImages([]);
    }
  };

  const handleWatermarkImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setWatermarkImage(e.target.files[0]);
    }
  };

  const addWatermark = (file: File): Promise<ProcessedImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;

          // Vẽ ảnh gốc
          ctx.drawImage(img, 0, 0);

          ctx.globalAlpha = opacity;

          // Thêm watermark text
          if (watermarkType === 'text' && watermarkText) {
            const lines = watermarkText.split('\n');
            const lineHeight = fontSize * 1.2;
            const totalHeight = lines.length * lineHeight;

            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = textColor;
            ctx.strokeStyle = textColor === '#ffffff' ? '#000000' : '#ffffff';
            ctx.lineWidth = 2;

            // Tính toán vị trí x, y cho text
            const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
            let x = img.width - maxWidth - 20;
            let y = 20;

            switch(position) {
              case 'top-left':
                x = 20;
                y = 20;
                break;
              case 'top-right':
                x = img.width - maxWidth - 20;
                y = 20;
                break;
              case 'bottom-left':
                x = 20;
                y = img.height - totalHeight - 20;
                break;
              case 'bottom-right':
                x = img.width - maxWidth - 20;
                y = img.height - totalHeight - 20;
                break;
              case 'center':
                x = (img.width - maxWidth) / 2;
                y = (img.height - totalHeight) / 2;
                break;
            }

            // Vẽ từng dòng text
            lines.forEach((line, index) => {
              const yPos = y + (index + 1) * lineHeight;
              ctx.strokeText(line, x, yPos);
              ctx.fillText(line, x, yPos);
            });

            ctx.globalAlpha = 1;

            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                resolve({
                  original: URL.createObjectURL(file),
                  processed: url,
                  name: file.name
                });
              }
            });
          }
          // Thêm watermark image
          else if (watermarkType === 'image' && watermarkImage) {
            const wmReader = new FileReader();
            wmReader.onload = (wmE) => {
              const wmImg = new Image();
              wmImg.onload = () => {
                const wmWidth = 200;
                const wmHeight = (wmImg.height / wmImg.width) * wmWidth;

                let x = img.width - wmWidth - 10;
                let y = 10;

                switch(position) {
                  case 'top-left':
                    x = 10;
                    y = 10;
                    break;
                  case 'top-right':
                    x = img.width - wmWidth - 10;
                    y = 10;
                    break;
                  case 'bottom-left':
                    x = 10;
                    y = img.height - wmHeight - 10;
                    break;
                  case 'bottom-right':
                    x = img.width - wmWidth - 10;
                    y = img.height - wmHeight - 10;
                    break;
                  case 'center':
                    x = (img.width - wmWidth) / 2;
                    y = (img.height - wmHeight) / 2;
                    break;
                }

                ctx.drawImage(wmImg, x, y, wmWidth, wmHeight);
                ctx.globalAlpha = 1;

                canvas.toBlob((blob) => {
                  if (blob) {
                    const url = URL.createObjectURL(blob);
                    resolve({
                      original: URL.createObjectURL(file),
                      processed: url,
                      name: file.name
                    });
                  }
                });
              };
              wmImg.src = wmE.target?.result as string;
            };
            wmReader.readAsDataURL(watermarkImage);
          } else {
            ctx.globalAlpha = 1;
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                resolve({
                  original: URL.createObjectURL(file),
                  processed: url,
                  name: file.name
                });
              }
            });
          }
        };
        img.src = e.target?.result as string;
      };

      reader.readAsDataURL(file);
    });
  };

  const processAllImages = async () => {
    setProcessing(true);
    const results: ProcessedImage[] = [];

    for (const file of files) {
      const result = await addWatermark(file);
      results.push(result);
    }

    setProcessedImages(results);
    setProcessing(false);
  };

  const downloadAll = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();

        for (const img of processedImages) {
          const response = await fetch(img.processed);
          const blob = await response.blob();
          const fileHandle = await dirHandle.getFileHandle(`watermarked_${img.name}`, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        }

        alert(`Đã lưu ${processedImages.length} ảnh vào thư mục đã chọn!`);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Lỗi khi lưu file:', err);
      }
    } else {
      processedImages.forEach((img, index) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = img.processed;
          a.download = `watermarked_${img.name}`;
          a.click();
        }, index * 200);
      });
    }
  };

  const downloadSingle = async (img: ProcessedImage) => {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: `watermarked_${img.name}`,
          types: [{
            description: 'Images',
            accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }
          }]
        });

        const response = await fetch(img.processed);
        const blob = await response.blob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        alert('Đã lưu ảnh thành công!');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Lỗi khi lưu file:', err);
      }
    } else {
      const a = document.createElement('a');
      a.href = img.processed;
      a.download = `watermarked_${img.name}`;
      a.click();
    }
  };

  const isDisabled =
    files.length === 0 ||
    processing ||
    (watermarkType === 'image' && !watermarkImage) ||
    (watermarkType === 'text' && !watermarkText);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '8px',
        padding: '40px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '40px',
          color: '#333',
          fontSize: '32px',
          fontWeight: '600'
        }}>
          Watermark Hàng Loạt
        </h1>

        <div style={{ marginBottom: '30px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontWeight: '600',
            color: '#333'
          }}>
            Chọn ảnh (nhiều file):
          </label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '15px',
              border: '2px dashed #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          />
          {files.length > 0 && (
            <p style={{ marginTop: '10px', color: '#666' }}>
              Đã chọn {files.length} ảnh
            </p>
          )}
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontWeight: '600',
            color: '#333'
          }}>
            Loại watermark:
          </label>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="image"
                checked={watermarkType === 'image'}
                onChange={() => setWatermarkType('image')}
                style={{ marginRight: '8px' }}
              />
              Ảnh
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                value="text"
                checked={watermarkType === 'text'}
                onChange={() => setWatermarkType('text')}
                style={{ marginRight: '8px' }}
              />
              Text
            </label>
          </div>

          {watermarkType === 'image' ? (
            <>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontWeight: '600',
                color: '#333'
              }}>
                Chọn ảnh watermark:
              </label>
              <input
                ref={watermarkInputRef}
                type="file"
                accept="image/*"
                onChange={handleWatermarkImageChange}
                style={{
                  width: '100%',
                  padding: '15px',
                  border: '2px dashed #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              />
            </>
          ) : (
            <>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontWeight: '600',
                color: '#333'
              }}>
                Nhập text watermark (nhiều dòng):
              </label>
              <textarea
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder={"Nhập text watermark\nCó thể nhiều dòng"}
                rows={4}
                style={{
                  width: '100%',
                  padding: '15px',
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                  fontFamily: 'Arial, sans-serif',
                  resize: 'vertical'
                }}
              />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '20px',
                marginTop: '20px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Kích thước chữ: {fontSize}px
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="150"
                    step="5"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '10px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Màu chữ:
                  </label>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontWeight: '600',
              color: '#333'
            }}>
              Vị trí:
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            >
              <option value="top-left">Trên trái</option>
              <option value="top-right">Trên phải</option>
              <option value="bottom-left">Dưới trái</option>
              <option value="bottom-right">Dưới phải</option>
              <option value="center">Giữa</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontWeight: '600',
              color: '#333'
            }}>
              Độ mờ: {opacity}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <button
            onClick={processAllImages}
            disabled={isDisabled}
            style={{
              background: isDisabled ? '#ccc' : '#333',
              color: 'white',
              border: 'none',
              padding: '12px 32px',
              fontSize: '16px',
              borderRadius: '4px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            {processing ? 'Đang xử lý...' : 'Gắn Watermark'}
          </button>
        </div>

        {processedImages.length > 0 && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ color: '#333', fontSize: '20px', fontWeight: '600' }}>Kết quả ({processedImages.length} ảnh)</h2>
              <button
                onClick={downloadAll}
                style={{
                  background: '#333',
                  color: 'white',
                  border: 'none',
                  padding: '10px 24px',
                  fontSize: '14px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Tải tất cả
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px'
            }}>
              {processedImages.map((img, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: '4px',
                    padding: '12px',
                    background: '#fff'
                  }}
                >
                  <img
                    src={img.processed}
                    alt={img.name}
                    style={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: '4px',
                      marginBottom: '10px'
                    }}
                  />
                  <p style={{
                    fontSize: '13px',
                    color: '#666',
                    marginBottom: '10px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {img.name}
                  </p>
                  <button
                    onClick={() => downloadSingle(img)}
                    style={{
                      width: '100%',
                      background: '#333',
                      color: 'white',
                      border: 'none',
                      padding: '8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px'
                    }}
                  >
                    Tải về
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
