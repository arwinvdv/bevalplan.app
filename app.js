document.addEventListener('alpine:init', () => {
  Alpine.data('birthPlan', () => {
    return {
      title: 'Bevalplan',
      subtitle: 'van Janine',
      searchTerm: '',
      showModal: false,
      showPrivacyModal: false,
      isExporting: false,
      selectedCategory: '',
      categoryTitles: {
        atmosphere: 'Sfeer',
        labor: 'Bevalling',
        birth: 'Geboorte'
      },
      icons: [
        {id: 1, src: iconSets[1][0], text1: 'Janine & Peter', text2: 'Eerste kindje', currentImageIndex: 0},
        {id: 2, src: iconSets[2][0], text1: 'Uitgerekende datum', text2: '1 januari 2025', currentImageIndex: 0},
        {id: 3, src: iconSets[3][0], text1: 'Geslacht', text2: 'Onbekend', currentImageIndex: 0},
        {id: 4, src: iconSets[4][0], text1: 'Verloskundige', text2: 'St. Anna', currentImageIndex: 0}
      ],
      images: defaultImages,
      selectedImages: {
        atmosphere: [],
        labor: [],
        birth: []
      },

      cycleIconImage(icon) {
        const iconSet = iconSets[icon.id];
        icon.currentImageIndex = (icon.currentImageIndex + 1) % iconSet.length;
        icon.src = iconSet[icon.currentImageIndex];
        this.saveState();
      },

      init() {
        this.loadState();
        const propertiesToWatch = ['title', 'subtitle', 'icons', 'selectedImages', 'categoryTitles'];
        propertiesToWatch.forEach(property => {
          this.$watch(property, () => {
            this.saveState();
          });
        });
      },

      loadState() {
        const urlParams = new URLSearchParams(window.location.search);
        const stateStr = urlParams.get('state');
        if (stateStr) {
          try {
            const state = JSON.parse(decodeURIComponent(atob(stateStr)));
            this.title = state.title;
            this.subtitle = state.subtitle;
            this.icons = state.icons.map(icon => ({
              ...icon,
              src: iconSets[icon.id][icon.currentImageIndex || 0]
            }));
            //si
            for (const category in state.si) {
              this.selectedImages[category] = state.si[category].map(img => {
                const image = this.images.find(i => i.id === img.id);
                return {
                  ...image,
                  customText: img.customText
                };
              });
            }
            this.categoryTitles = state.categoryTitles;
          } catch (error) {
            console.error('Error loading state:', error);
          }
        }
      },

      saveState() {
        let selectedImagesMinimized = {};
        // Save only customText and id for selected images, remove the other properties
        for (const category in this.selectedImages) {
          selectedImagesMinimized[category] = this.selectedImages[category].map(img => ({
            id: img.id,
            customText: img.customText
          }));
        }

        const state = {
          title: this.title,
          subtitle: this.subtitle,
          icons: this.icons.map(icon => ({
            id: icon.id,
            text1: icon.text1,
            text2: icon.text2,
            currentImageIndex: icon.currentImageIndex || 0
          })),
          si: selectedImagesMinimized,
          categoryTitles: this.categoryTitles
        };
        const stateStr = btoa(encodeURIComponent(JSON.stringify(state)));
        window.history.replaceState(null, '', `${window.location.pathname}?state=${stateStr}`);
      },

      toggleImage(image) {
        const category = this.selectedImages[image.category];
        const index = category.findIndex(img => img.id === image.id);

        if (index === -1) {
          this.selectedImages[image.category] = [...category, {...image, customText: image.title}];
        } else {
          this.selectedImages[image.category] = category.filter(img => img.id !== image.id);
        }

        this.saveState();
      },

      moveImage(category, index, direction) {
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex >= 0 && newIndex < this.selectedImages[category].length) {
          const images = [...this.selectedImages[category]]
          const temp = images[index]
          images[index] = images[newIndex]
          images[newIndex] = temp
          this.selectedImages[category] = images
          this.saveState()
        }
      },

      deleteImage(category, index) {
        this.selectedImages[category] = this.selectedImages[category].filter((_, i) => i !== index)
        this.saveState()
      },

      filteredImages() {
        return this.images.filter(img =>
          (this.selectedCategory === '' || img.category === this.selectedCategory) &&
          (this.searchTerm === '' ||
            img.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            img.description.toLowerCase().includes(this.searchTerm.toLowerCase()))
        );
      },

      isSelected(image) {
        return this.selectedImages[image.category].some(img => img.id === image.id);
      },

      async exportPDF() {
        this.isExporting = true;
        try {
          const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });

          const pageWidth = 210;
          const margin = 15;
          const contentWidth = pageWidth - (2 * margin);

          // Set font sizes
          const titleSize = 24;
          const subtitleSize = 14;
          const categorySize = 12;
          const textSize = 9;

          const urlParams = new URLSearchParams(window.location.search);
          const stateStr = urlParams.get('state');

          // Watermark
          pdf.setTextColor(200);
          pdf.setFontSize(12);
          pdf.textWithLink('bevalplan.app', 105, 287, {
            url: `https://bevalplan.app?state=${stateStr}`,
            align: 'center'
          });

          // Reset color for regular content
          pdf.setTextColor(0, 0, 0);

          // Add title and subtitle
          pdf.setFontSize(titleSize);
          pdf.text(this.title, pageWidth / 2, margin, {align: 'center'});
          pdf.setFontSize(subtitleSize);
          pdf.text(this.subtitle, pageWidth / 2, margin + 7, {align: 'center'});

          let yPosition = margin + 12;

          // Add icons section with proper spacing
          const iconsPerRow = 4;
          const iconWidth = 45;
          const iconSpacing = (contentWidth - (iconsPerRow * iconWidth)) / (iconsPerRow - 1);
          const iconStartX = margin + 10;

          // Load and add icons
          for (let i = 0; i < this.icons.length; i++) {
            const icon = this.icons[i];
            const xPos = iconStartX + (i * (iconWidth + iconSpacing));

            try {
              if (icon.src) {
                const {imgData, aspectRatio} = await this.getImageDataWithAspectRatio(icon.src);
                pdf.addImage(imgData, 'JPEG', xPos, yPosition, iconWidth / 2, iconWidth / 2, '', 'FAST');
              }

              pdf.setFontSize(textSize);
              pdf.text(icon.text1, xPos + (iconWidth / 4), yPosition + 27, {align: 'center', maxWidth: iconWidth});
              pdf.setFont(undefined, 'bold');
              pdf.text(icon.text2, xPos + (iconWidth / 4), yPosition + 32, {align: 'center', maxWidth: iconWidth});
              pdf.setFont(undefined, 'normal');
            } catch (error) {
              console.error('Error loading icon:', error);
            }
          }

          yPosition = margin + 57;

          // Add categories and their images
          for (const category of ['atmosphere', 'labor', 'birth']) {
            if (this.selectedImages[category].length > 0) {
              // Add category title
              pdf.setFontSize(categorySize);
              pdf.setFillColor(240, 240, 240);
              // Make rectangle with rounded corners
              pdf.roundedRect(margin, yPosition, contentWidth, 8, 1, 1, 'F');
              pdf.text(this.categoryTitles[category], pageWidth / 2, yPosition + 6, {align: 'center'});

              yPosition += 11;

              // Calculate image layout
              const maxImagesPerRow = 5;
              const maxDimension = 25;
              const imageSpacing = (contentWidth - (maxImagesPerRow * maxDimension)) / (maxImagesPerRow - 1);

              for (let i = 0; i < this.selectedImages[category].length; i++) {
                const image = this.selectedImages[category][i];
                const row = Math.floor(i / maxImagesPerRow);
                const col = i % maxImagesPerRow;
                const xPos = margin + (col * (maxDimension + imageSpacing));
                const currentY = yPosition + (row * (maxDimension + 15));

                try {
                  const {imgData, aspectRatio} = await this.getImageDataWithAspectRatio(image.src);

                  // Calculate dimensions while respecting both max width and height
                  let finalWidth, finalHeight;
                  if (aspectRatio > 1) {
                    // Landscape image
                    finalWidth = maxDimension;
                    finalHeight = finalWidth / aspectRatio;
                    if (finalHeight > maxDimension) {
                      finalHeight = maxDimension;
                      finalWidth = finalHeight * aspectRatio;
                    }
                  } else {
                    // Portrait image
                    finalHeight = maxDimension;
                    finalWidth = finalHeight * aspectRatio;
                    if (finalWidth > maxDimension) {
                      finalWidth = maxDimension;
                      finalHeight = finalWidth / aspectRatio;
                    }
                  }

                  // Center the image within its allocated space
                  const xOffset = (maxDimension - finalWidth) / 2;
                  const yOffset = (maxDimension - finalHeight) / 2;
                  pdf.addImage(imgData, 'JPEG', xPos + xOffset, currentY + yOffset, finalWidth, finalHeight, '', 'FAST');

                  // Center text below the image
                  pdf.setFontSize(textSize);
                  pdf.text(image.customText || '', xPos + (maxDimension / 2), currentY + maxDimension + 5, {
                    align: 'center',
                    maxWidth: maxDimension + 2
                  });
                } catch (error) {
                  console.error('Error loading image:', error);
                }
              }

              const rows = Math.ceil(this.selectedImages[category].length / maxImagesPerRow);
              yPosition += (rows * 37) + 3;
            }
          }

          pdf.save('bevalplan.pdf');
        } catch (error) {
          console.error('Error exporting PDF:', error);
          alert('Er is een fout opgetreden bij het exporteren van de PDF. Probeer het opnieuw.');
        } finally {
          this.isExporting = false;
        }
      },
      async getImageDataWithAspectRatio(url) {
        const img = await this.loadImage(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        return {
          imgData: canvas.toDataURL('image/jpeg'),
          aspectRatio: img.width / img.height
        };
      },
      async loadImage(url) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      },
    };
  })
})
