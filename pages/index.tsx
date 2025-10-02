import { useState, useRef } from 'react';
import Head from 'next/head';

interface ProcessedImage {
  original: string;
  processed: string;
  name: string;
}

export default function WatermarkPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null);
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

          // Thêm watermark image
          if (watermarkImage) {
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

                ctx.globalAlpha = opacity;
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
    // Hỏi thư mục lưu
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();

        for (const img of processedImages) {
          const response = await fetch(img.processed);
          const blob = await response.blob();
          const fileHandle = await dirHandle.getFileHandle(`watermarked_${img.name}`, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        }

        alert(`Đã lưu ${processedImages.length} ảnh vào thư mục đã chọn!`);
      } catch (err: any) {
        // Nếu user cancel thì không làm gì
        if (err.name === 'AbortError') {
          return;
        }
        // Nếu lỗi khác thì báo
        console.error('Lỗi khi lưu file:', err);
      }
    } else {
      // Trình duyệt cũ - download từng file
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
    // Hỏi vị trí lưu
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
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
      } catch (err: any) {
        // User cancel - dừng lại
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Lỗi khi lưu file:', err);
      }
    } else {
      // Trình duyệt cũ - download thông thường
      const a = document.createElement('a');
      a.href = img.processed;
      a.download = `watermarked_${img.name}`;
      a.click();
    }
  };

  return (
    <>
      <Head>
        <title>Watermark Hàng Loạt</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

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
              disabled={files.length === 0 || processing}
              style={{
                background: files.length === 0 || processing ? '#ccc' : '#333',
                color: 'white',
                border: 'none',
                padding: '12px 32px',
                fontSize: '16px',
                borderRadius: '4px',
                cursor: files.length === 0 || processing ? 'not-allowed' : 'pointer',
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
    </>
  );
}
